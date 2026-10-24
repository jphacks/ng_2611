import { getSupabaseClient } from '../auth/supabase-client.js';

const ROOM_CODE_PATTERN = /^[0-9]{4}$/;

const ERROR_MESSAGES = {
  AUTH_REQUIRED: 'ルーム機能を使うには Google でログインしてください。',
  ROOM_CODE_MUST_BE_4_DIGITS: 'ルームIDは0000〜9999の4桁で入力してください。',
  DISPLAY_NAME_INVALID: '表示名は1〜40文字で入力してください。',
  ROOM_CODE_IN_USE: 'このルームIDはすでに使われています。別のIDを入力してください。',
  ALREADY_IN_ANOTHER_ROOM: 'すでに別のルームに参加しています。先に退出してください。',
  ROOM_NOT_FOUND: 'ルームが見つかりません。ルームIDを確認してください。',
  MEMBER_KICKED: 'このルームへの参加は禁止されています。ホストに解除を依頼してください。',
  ALREADY_IN_ROOM: 'すでにこのルームに参加しています。',
  DISPLAY_NAME_IN_USE: 'この表示名はルーム内で使われています。別の名前を入力してください。',
  ACTIVE_MEMBERSHIP_REQUIRED: 'このルームの参加者ではありません。',
  HOST_REQUIRED: 'この操作はホストだけが実行できます。',
  NEW_HOST_MUST_BE_ACTIVE_MEMBER: '新しいホストには、現在参加中のメンバーを指定してください。',
  CANNOT_KICK_OWNER_OR_SELF: 'ルーム作成者または自分自身をキックすることはできません。',
  ACTIVE_MEMBER_NOT_FOUND: '対象の参加者が見つかりません。',
  KICKED_MEMBER_NOT_FOUND: '解除するキック済みメンバーが見つかりません。',
  STAGE_ID_REQUIRED: 'ステージを指定してください。',
  ROOM_ALREADY_STARTED: 'このルームのステージはすでに開始されています。',
  ROOM_CREATOR_REQUIRED: 'ルームを削除できるのは作成者だけです。',
};

function requireClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw createRoomError('Supabase が設定されていません。環境変数を確認してください。', 'SUPABASE_NOT_CONFIGURED');
  }
  return client;
}

function createRoomError(message, code, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

function normalizeRoomError(error) {
  if (!error) return error;

  const detail = `${error.message ?? ''} ${error.details ?? ''}`;
  const knownCode = Object.keys(ERROR_MESSAGES).find((code) => detail.includes(code));
  if (knownCode) {
    return createRoomError(ERROR_MESSAGES[knownCode], knownCode, error);
  }

  if (error.code === '23505') {
    return createRoomError('入力内容がほかの参加者と重複しています。確認してもう一度お試しください。', error.code, error);
  }

  return createRoomError(error.message || 'ルームの処理に失敗しました。', error.code || 'ROOM_OPERATION_FAILED', error);
}

async function requireSignedInUser() {
  const client = requireClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw normalizeRoomError(error);
  if (!data.user) throw createRoomError(ERROR_MESSAGES.AUTH_REQUIRED, 'AUTH_REQUIRED');
  return { client, user: data.user };
}

function validateRoomCode(roomCode) {
  const normalized = String(roomCode ?? '').trim();
  if (!ROOM_CODE_PATTERN.test(normalized)) {
    throw createRoomError(ERROR_MESSAGES.ROOM_CODE_MUST_BE_4_DIGITS, 'ROOM_CODE_MUST_BE_4_DIGITS');
  }
  return normalized;
}

function validateDisplayName(displayName) {
  const normalized = String(displayName ?? '').trim();
  if (normalized.length < 1 || normalized.length > 40) {
    throw createRoomError(ERROR_MESSAGES.DISPLAY_NAME_INVALID, 'DISPLAY_NAME_INVALID');
  }
  return normalized;
}

async function callRpc(client, functionName, args) {
  const { data, error } = await client.rpc(functionName, args);
  if (error) throw normalizeRoomError(error);
  return data;
}

/** Create a room and make the signed-in user its creator, host, and first member. */
export async function createRoom({ roomCode, displayName }) {
  const { client } = await requireSignedInUser();
  return callRpc(client, 'create_room', {
    p_room_code: validateRoomCode(roomCode),
    p_display_name: validateDisplayName(displayName),
  });
}

/** Join a room using its four-digit code and the member's chosen display name. */
export async function joinRoom({ roomCode, displayName }) {
  const { client } = await requireSignedInUser();
  return callRpc(client, 'join_room', {
    p_room_code: validateRoomCode(roomCode),
    p_display_name: validateDisplayName(displayName),
  });
}

/** Read room details and the members visible to the current user by RLS. */
export async function getRoom(roomCode) {
  const { client } = await requireSignedInUser();
  const normalizedCode = validateRoomCode(roomCode);
  const { data: room, error: roomError } = await client
    .from('rooms')
    .select('id, room_code, created_by, host_user_id, stage_id, started_at, created_at')
    .eq('room_code', normalizedCode)
    .maybeSingle();

  if (roomError) throw normalizeRoomError(roomError);
  if (!room) throw createRoomError(ERROR_MESSAGES.ROOM_NOT_FOUND, 'ROOM_NOT_FOUND');

  const { data: members, error: membersError } = await client
    .from('room_members')
    .select('user_id, display_name, current_stage_id, completed_stage_ids, joined_at, left_at, kicked_at')
    .eq('room_id', room.id)
    .order('joined_at', { ascending: true });

  if (membersError) throw normalizeRoomError(membersError);

  return { ...room, members: members ?? [] };
}

/** Subscribe to room and member table changes. The returned function removes the channel. */
export async function subscribeToRoom(roomId, onChange, onStatus = () => {}, channelScope = 'lobby') {
  const { client } = await requireSignedInUser();
  if (!roomId) throw new TypeError('ルームIDを指定してください。');
  if (typeof onChange !== 'function') throw new TypeError('変更時のコールバックを指定してください。');

  const channel = client
    .channel(`room-${channelScope}-${roomId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}`,
    }, onChange)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}`,
    }, onChange)
    .subscribe(onStatus);

  return () => client.removeChannel(channel);
}

export async function leaveRoom(roomCode) {
  const { client } = await requireSignedInUser();
  return callRpc(client, 'leave_room', { p_room_code: validateRoomCode(roomCode) });
}

export async function deleteRoom(roomCode) {
  const { client } = await requireSignedInUser();
  return callRpc(client, 'delete_room', { p_room_code: validateRoomCode(roomCode) });
}

export async function setRoomHost(roomCode, newHostUserId) {
  const { client } = await requireSignedInUser();
  if (!newHostUserId) throw new TypeError('新しいホストのユーザーIDを指定してください。');
  return callRpc(client, 'set_room_host', {
    p_room_code: validateRoomCode(roomCode),
    p_new_host_user_id: newHostUserId,
  });
}

export async function kickRoomMember(roomCode, targetUserId) {
  const { client } = await requireSignedInUser();
  if (!targetUserId) throw new TypeError('キックするメンバーのユーザーIDを指定してください。');
  return callRpc(client, 'kick_room_member', {
    p_room_code: validateRoomCode(roomCode),
    p_target_user_id: targetUserId,
  });
}

export async function unkickRoomMember(roomCode, targetUserId) {
  const { client } = await requireSignedInUser();
  if (!targetUserId) throw new TypeError('解除するメンバーのユーザーIDを指定してください。');
  return callRpc(client, 'unkick_room_member', {
    p_room_code: validateRoomCode(roomCode),
    p_target_user_id: targetUserId,
  });
}

export async function setRoomStage(roomCode, stageId) {
  const { client } = await requireSignedInUser();
  const normalizedStageId = String(stageId ?? '').trim();
  if (!normalizedStageId) throw createRoomError(ERROR_MESSAGES.STAGE_ID_REQUIRED, 'STAGE_ID_REQUIRED');
  return callRpc(client, 'set_room_stage', {
    p_room_code: validateRoomCode(roomCode),
    p_stage_id: normalizedStageId,
  });
}

export async function startRoom(roomCode) {
  const { client } = await requireSignedInUser();
  return callRpc(client, 'start_room', { p_room_code: validateRoomCode(roomCode) });
}

export async function updateRoomProgress(roomCode, { currentStageId = null, completedStageIds = [] } = {}) {
  const { client } = await requireSignedInUser();
  if (!Array.isArray(completedStageIds)) {
    throw new TypeError('クリア済みステージIDは配列で指定してください。');
  }
  return callRpc(client, 'update_room_progress', {
    p_room_code: validateRoomCode(roomCode),
    p_current_stage_id: currentStageId,
    p_completed_stage_ids: completedStageIds,
  });
}
