// lib/supabaseService.ts - UPDATED VERSION
// This version aligns perfectly with the new consolidated backend SQL

import { supabase } from './supabaseClient';
import type {
  Session,
  SessionMessage,
  Friend,
  Tag,
  FriendRequest,
  Notification,
  Profile,
  Conversation,
  DirectMessage,
  Vouch,
} from '../types';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generic response handler for Supabase queries
 */
async function handleResponse<T>(
  query: PromiseLike<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  try {
    const { data, error } = await query;
    if (error) {
      console.error('Supabase API Error:', error.message, error);
      return { data: null, error };
    }
    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { data: null, error };
  }
}

/**
 * Maps database session record to frontend Session type
 */
function mapSessionFromDB(s: any): Session {
  return {
    ...s,
    sessionType: s.session_type,
    event_time: s.event_time,
    creator_id: s.creator_id,
    visibleToTags: s.visible_to_tags || [],
    participantRoles: s.participant_roles || {},
    helpCategory: s.help_category,
    skillTag: s.skill_tag,
    expectedOutcome: s.expected_outcome,
    returnTime: s.return_time,
    creator: s.creator || { username: 'Unknown' },
  };
}

/**
 * Maps database conversation record to frontend Conversation type
 */
function mapConversationFromDB(c: any): Omit<Conversation, 'messages' | 'unreadCount'> {
  return {
    id: c.id,
    participantIds: c.participant_ids,
  };
}

// ============================================
// SESSIONS
// ============================================

/**
 * Fetch all active sessions
 */
export const fetchActiveSessions = () => {
  return handleResponse<Session[]>(
    supabase
      .from('sessions')
      .select(`
        *,
        creator:profiles!creator_id(username)
      `)
      .eq('status', 'active')
      .order('event_time', { ascending: false })
      .then(({ data, error }) => ({
        data: data ? data.map(mapSessionFromDB) : null,
        error,
      }))
  );
};

/**
 * Create a new session
 */
export const createSession = (sessionData: any) => {
  const dbData = {
    title: sessionData.title,
    description: sessionData.description || '',
    lat: sessionData.lat,
    lng: sessionData.lng,
    session_type: sessionData.sessionType,
    emoji: sessionData.emoji,
    event_time: sessionData.event_time,
    duration: sessionData.duration,
    status: sessionData.status || 'active',
    creator_id: sessionData.creator_id,
    participants: sessionData.participants || [],
    participant_roles: sessionData.participantRoles || {},
    privacy: sessionData.privacy || 'public',
    visible_to_tags: sessionData.visibleToTags || [],
    help_category: sessionData.helpCategory,
    skill_tag: sessionData.skillTag,
    expected_outcome: sessionData.expectedOutcome,
    return_time: sessionData.returnTime,
    urgency: sessionData.urgency,
    flow: sessionData.flow,
  };

  return handleResponse<Session[]>(
    supabase
      .from('sessions')
      .insert([dbData])
      .select(`
        *,
        creator:profiles!creator_id(username)
      `)
      .then(({ data, error }) => ({
        data: data ? data.map(mapSessionFromDB) : null,
        error,
      }))
  );
};

/**
 * Update a session (for creator actions like extending time)
 */
export const updateSession = (sessionId: number, updates: Partial<any>) => {
  const dbUpdates: any = {};
  if (updates.participants) dbUpdates.participants = updates.participants;
  if (updates.participantRoles) dbUpdates.participant_roles = updates.participantRoles;
  if (updates.duration !== undefined) dbUpdates.duration = updates.duration;
  if (updates.status) dbUpdates.status = updates.status;
  if (updates.creator_id) dbUpdates.creator_id = updates.creator_id;

  return handleResponse<Session[]>(
    supabase
      .from('sessions')
      .update(dbUpdates)
      .eq('id', sessionId)
      .select(`
        *,
        creator:profiles!creator_id(username)
      `)
      .then(({ data, error }) => ({
        data: data ? data.map(mapSessionFromDB) : null,
        error,
      }))
  );
};

/**
 * Delete/close a session
 */
export const deleteSession = (sessionId: number) => {
  return handleResponse<any>(
    supabase.from('sessions').delete().eq('id', sessionId)
  );
};

/**
 * Join a session using the safe RPC function
 */
export const joinSession = async (
  sessionId: number,
  userId: string,
  role: 'seeking' | 'offering' | 'participant' | 'giver' = 'participant'
) => {
  try {
    const { data, error } = await supabase.rpc('join_session_safe', {
      p_session_id: sessionId,
      p_user_id: userId,
      p_role: role,
    });

    if (error) {
      console.error('Error joining session:', error);
      return { data: null, error };
    }

    if (data && !data.success) {
      return {
        data: null,
        error: new Error(data.error || 'Failed to join session'),
      };
    }

    return {
      data: [
        {
          participants: data.participants,
          participant_roles: data.participant_roles,
        },
      ],
      error: null,
    };
  } catch (e) {
    console.error('Unexpected error in joinSession:', e);
    return { data: null, error: e };
  }
};

/**
 * Leave a session using the safe RPC function
 */
export const leaveSession = async (sessionId: number, userId: string) => {
  try {
    const { data, error } = await supabase.rpc('leave_session_safe', {
      p_session_id: sessionId,
      p_user_id: userId,
    });

    if (error) {
      console.error('Error leaving session:', error);
      return { data: null, error };
    }

    if (data && !data.success) {
      return {
        data: null,
        error: new Error(data.error || 'Failed to leave session'),
      };
    }

    return { data, error: null };
  } catch (e) {
    console.error('Unexpected error in leaveSession:', e);
    return { data: null, error: e };
  }
};

// ============================================
// VOUCHING / COOKIE SCORE
// ============================================

/**
 * Create a vouch using the safe RPC function
 */
export const createVouch = async (
  voucherId: string,
  receiverId: string,
  sessionId: number,
  skill: string
) => {
  try {
    const { data, error } = await supabase.rpc('create_vouch_safe', {
      p_voucher_id: voucherId,
      p_receiver_id: receiverId,
      p_session_id: sessionId,
      p_skill: skill,
    });

    if (error) {
      console.error('Error creating vouch:', error);
      return { data: null, error };
    }

    if (data && !data.success) {
      return {
        data: null,
        error: new Error(data.error || 'Failed to create vouch'),
      };
    }

    return { data, error: null };
  } catch (e) {
    console.error('Unexpected error in createVouch:', e);
    return { data: null, error: e };
  }
};

/**
 * Fetch user's vouch history
 */
export const fetchUserVouchHistory = (userId: string) => {
  return handleResponse<Vouch[]>(
    supabase
      .rpc('get_user_vouch_history', { p_user_id: userId })
      .then(({ data, error }) => ({
        data: data
          ? data.map((v: any) => ({
              id: v.vouch_id,
              voucherUsername: v.voucher_username,
              skill: v.skill_name,
              points: v.points_earned,
              timestamp: v.created_timestamp,
            }))
          : null,
        error,
      }))
  );
};

// ============================================
// FRIENDS & SOCIAL
// ============================================

/**
 * Fetch user's friends
 */
export const fetchFriends = async (userId: string) => {
  try {
    const { data: friendships, error: friendshipsError } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', userId);

    if (friendshipsError) throw friendshipsError;
    if (!friendships || friendships.length === 0) {
      return { data: [], error: null };
    }

    const friendIds = friendships.map((f: any) => f.friend_id);

    const { data: friends, error: friendsError } = await supabase
      .from('profiles')
      .select('id, username, branch, year, cookie_score')
      .in('id', friendIds);

    if (friendsError) throw friendsError;

    const friendsWithMutuals: Friend[] = friends
      ? friends.map((p: any) => ({
          id: p.id,
          username: p.username,
          branch: p.branch,
          year: p.year,
          cookieScore: p.cookie_score,
          mutualFriends: 0,
        }))
      : [];

    return { data: friendsWithMutuals, error: null };
  } catch (error: any) {
    console.error('Error in fetchFriends:', error);
    return { data: null, error };
  }
};

/**
 * Fetch friend requests (both sent and received)
 */
export const fetchFriendRequests = (userId: string) => {
  return handleResponse<FriendRequest[]>(
    supabase
      .from('friend_requests')
      .select('id, from_user_id, to_user_id')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .then(({ data, error }) => ({
        data: data
          ? data.map((d: any) => ({
              id: d.id,
              fromUserId: d.from_user_id,
              toUserId: d.to_user_id,
            }))
          : null,
        error,
      }))
  );
};

/**
 * Send a friend request
 */
export const sendFriendRequest = (fromUserId: string, toUserId: string) => {
  return handleResponse<any[]>(
    supabase
      .from('friend_requests')
      .insert([{ from_user_id: fromUserId, to_user_id: toUserId }])
      .select('id, from_user_id, to_user_id')
  );
};

/**
 * Accept a friend request using the RPC function
 */
export const acceptFriendRequest = async (
  requestId: string,
  fromUserId: string,
  toUserId: string
) => {
  try {
    const { data, error } = await supabase.rpc('accept_friend_request', {
      request_id: requestId,
    });

    if (error) {
      console.error('Error accepting friend request:', error);
      return { data: null, error };
    }

    return { data: true, error: null };
  } catch (error: any) {
    console.error('Error accepting friend request:', error.message || error);
    return { data: null, error };
  }
};

/**
 * Reject a friend request
 */
export const rejectFriendRequest = (requestId: string) => {
  return handleResponse<any>(
    supabase.from('friend_requests').delete().eq('id', requestId)
  );
};

/**
 * Remove a friend (deletes both friendship records)
 */
export const removeFriend = async (userId: string, friendId: string) => {
  try {
    const { error: error1 } = await supabase
      .from('friendships')
      .delete()
      .match({ user_id: userId, friend_id: friendId });
    if (error1) throw error1;

    const { error: error2 } = await supabase
      .from('friendships')
      .delete()
      .match({ user_id: friendId, friend_id: userId });
    if (error2) throw error2;

    return { data: true, error: null };
  } catch (error) {
    console.error('Error removing friend:', error);
    return { data: null, error };
  }
};

// ============================================
// TAGS
// ============================================

/**
 * Fetch user's tags
 */
export const fetchTags = (userId: string) => {
  return handleResponse<Tag[]>(
    supabase
      .from('tags')
      .select('*')
      .or(`creator_id.eq.${userId},member_ids.cs.{${userId}}`)
      .then(({ data, error }) => ({
        data: data
          ? data.map((t: any) => ({
              id: t.id,
              name: t.name,
              color: t.color,
              emoji: t.emoji,
              memberIds: t.member_ids || [],
              creator_id: t.creator_id,
            }))
          : null,
        error,
      }))
  );
};

/**
 * Create a new tag
 */
export const createTag = (
  tagData: Omit<Tag, 'id' | 'memberIds' | 'creator_id'>,
  userId: string
) => {
  const dataToInsert = {
    name: tagData.name,
    color: tagData.color,
    emoji: tagData.emoji,
    creator_id: userId,
    member_ids: [],
  };
  return handleResponse<Tag[]>(
    supabase
      .from('tags')
      .insert([dataToInsert])
      .select()
      .then(({ data, error }) => ({
        data: data
          ? data.map((t: any) => ({
              id: t.id,
              name: t.name,
              color: t.color,
              emoji: t.emoji,
              memberIds: t.member_ids || [],
              creator_id: t.creator_id,
            }))
          : null,
        error,
      }))
  );
};

/**
 * Update a tag
 */
export const updateTag = (
  tagId: string,
  updates: Partial<Omit<Tag, 'id' | 'creator_id'>>
) => {
  const dbUpdates: any = {};
  if (updates.name) dbUpdates.name = updates.name;
  if (updates.color) dbUpdates.color = updates.color;
  if (updates.emoji) dbUpdates.emoji = updates.emoji;
  if (updates.memberIds) dbUpdates.member_ids = updates.memberIds;
  return handleResponse<Tag[]>(
    supabase
      .from('tags')
      .update(dbUpdates)
      .eq('id', tagId)
      .select()
      .then(({ data, error }) => ({
        data: data
          ? data.map((t: any) => ({
              id: t.id,
              name: t.name,
              color: t.color,
              emoji: t.emoji,
              memberIds: t.member_ids || [],
              creator_id: t.creator_id,
            }))
          : null,
        error,
      }))
  );
};

/**
 * Delete a tag
 */
export const deleteTag = (tagId: string) => {
  return handleResponse<any>(supabase.from('tags').delete().eq('id', tagId));
};

// ============================================
// USER PROFILES
// ============================================

/**
 * Fetch profiles by IDs
 */
export const fetchProfilesByIds = (userIds: string[]) => {
  return handleResponse<Friend[]>(
    supabase
      .from('profiles')
      .select('id, username, branch, year, cookie_score')
      .in('id', userIds)
      .then(({ data, error }) => ({
        data: data
          ? data.map((p: any) => ({
              id: p.id,
              username: p.username,
              branch: p.branch,
              year: p.year,
              cookieScore: p.cookie_score,
              mutualFriends: 0,
            }))
          : null,
        error,
      }))
  );
};

/**
 * Search users by username
 */
export const searchUsers = (query: string, currentUserId: string) => {
  return handleResponse<Friend[]>(
    supabase
      .from('profiles')
      .select('id, username, branch, year, cookie_score')
      .ilike('username', `%${query}%`)
      .neq('id', currentUserId)
      .limit(20)
      .then(({ data, error }) => ({
        data: data
          ? data.map((p: any) => ({
              id: p.id,
              username: p.username,
              branch: p.branch,
              year: p.year,
              cookieScore: p.cookie_score,
              mutualFriends: 0,
            }))
          : null,
        error,
      }))
  );
};

/**
 * Update user profile
 */
export const updateUserProfile = (userId: string, profileData: Profile) => {
  const dbData = {
    bio: profileData.bio,
    branch: profileData.branch,
    year: profileData.year,
    expertise: profileData.expertise,
    interests: profileData.interests,
    privacy: profileData.privacy,
  };
  return handleResponse<(Profile & { id: string })[]>(
    supabase.from('profiles').update(dbData).eq('id', userId).select()
  );
};

// ============================================
// SESSION HISTORY & MESSAGES
// ============================================

/**
 * Fetch user's session history (closed sessions)
 */
export const fetchUserSessionHistory = (userId: string) => {
  return handleResponse<Session[]>(
    supabase
      .from('sessions')
      .select('*, creator:profiles!creator_id(username)')
      .or(`creator_id.eq.${userId},participants.cs.{${userId}}`)
      .eq('status', 'closed')
      .order('event_time', { ascending: false })
      .limit(50)
      .then(({ data, error }) => ({
        data: data ? data.map(mapSessionFromDB) : null,
        error,
      }))
  );
};

/**
 * Fetch messages for a session
 */
export const fetchSessionMessages = (sessionId: number) => {
  return handleResponse<SessionMessage[]>(
    supabase
      .from('session_messages')
      .select('*, sender:profiles(username)')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
  );
};

/**
 * Send a message in a session
 */
export const sendSessionMessage = (
  sessionId: number,
  senderId: string,
  text: string
) => {
  return handleResponse<any>(
    supabase
      .from('session_messages')
      .insert([{ session_id: sessionId, sender_id: senderId, text }])
  );
};

// ============================================
// NOTIFICATIONS
// ============================================

/**
 * Fetch user's notifications with enriched data
 */
export const fetchNotifications = (userId: string) => {
  return handleResponse<Notification[]>(
    supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(async ({ data, error }) => {
        if (error || !data) return { data: null, error };

        // Enrich notifications with user/session/tag details
        const enrichedData = await Promise.all(
          data.map(async (n: any) => {
            let user = null,
              session = null,
              tag = null;

            if (n.actor_id) {
              const { data: userData } = await supabase
                .from('profiles')
                .select('id, username')
                .eq('id', n.actor_id)
                .single();
              user = userData;
            }
            if (n.session_id) {
              const { data: sessionData } = await supabase
                .from('sessions')
                .select('id, title, emoji')
                .eq('id', n.session_id)
                .single();
              session = sessionData;
            }
            if (n.tag_id) {
              const { data: tagData } = await supabase
                .from('tags')
                .select('id, name')
                .eq('id', n.tag_id)
                .single();
              tag = tagData;
            }

            return {
              id: n.id,
              type: n.type,
              user: user ? { id: user.id, username: user.username } : undefined,
              session: session
                ? { id: session.id, title: session.title, emoji: session.emoji }
                : undefined,
              tag: tag ? { id: tag.id, name: tag.name } : undefined,
              timestamp: n.created_at,
              isRead: n.is_read,
            };
          })
        );

        return { data: enrichedData, error: null };
      })
  );
};

/**
 * Mark a notification as read
 */
export const markNotificationAsRead = (notificationId: string) => {
  return handleResponse<any>(
    supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
  );
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = (userId: string) => {
  return handleResponse<any>(
    supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', userId)
      .eq('is_read', false)
  );
};

/**
 * Delete a notification
 */
export const deleteNotification = (notificationId: string) => {
  return handleResponse<any>(
    supabase.from('notifications').delete().eq('id', notificationId)
  );
};

/**
 * Create a notification using the safe RPC function
 */
export const createNotification = async (
  notificationData: Omit<Notification, 'id' | 'timestamp' | 'isRead'>,
  recipientId: string
) => {
  try {
    const { data, error } = await supabase.rpc('create_notification_safe', {
      p_recipient_id: recipientId,
      p_type: notificationData.type,
      p_actor_id: notificationData.user?.id || null,
      p_session_id: notificationData.session?.id || null,
      p_tag_id: notificationData.tag?.id || null,
    });

    if (error) {
      console.error('Error creating notification:', error);
      return { data: null, error };
    }

    // Handle the jsonb return format from the function
    if (data && !data.success) {
      return {
        data: null,
        error: new Error(data.error || 'Failed to create notification'),
      };
    }

    return { data, error: null };
  } catch (e: any) {
    console.error('Unexpected error in createNotification:', e);
    return { data: null, error: e };
  }
};

// ============================================
// DIRECT MESSAGES
// ============================================

/**
 * Fetch user's conversations
 */
export const fetchConversationsForUser = (userId: string) => {
  return handleResponse<Conversation[]>(
    supabase
      .from('conversations')
      .select('*')
      .contains('participant_ids', [userId])
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => ({
        data: data
          ? data.map((c: any) => ({
              id: c.id,
              participantIds: c.participant_ids,
              messages: [],
              unreadCount: 0,
            }))
          : null,
        error,
      }))
  );
};

/**
 * Fetch messages for a conversation
 */
export const fetchMessagesForConversation = (conversationId: string) => {
  return handleResponse<DirectMessage[]>(
    supabase
      .from('direct_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: true })
      .then(({ data, error }) => ({
        data: data
          ? data.map((d: any) => ({
              id: d.id,
              conversation_id: d.conversation_id,
              senderId: d.sender_id,
              text: d.text,
              timestamp: d.timestamp,
            }))
          : null,
        error,
      }))
  );
};

/**
 * Send a direct message
 */
export const sendDirectMessage = (
  conversationId: string,
  senderId: string,
  text: string
) => {
  return handleResponse<DirectMessage[]>(
    supabase
      .from('direct_messages')
      .insert([{ conversation_id: conversationId, sender_id: senderId, text }])
  );
};

/**
 * Get or create a conversation between two users
 */
export const getOrCreateConversation = async (
  userId1: string,
  userId2: string
): Promise<{
  data: Omit<Conversation, 'messages' | 'unreadCount'> | null;
  error: any;
}> => {
  try {
    const { data: conversationId, error } = await supabase.rpc(
      'get_or_create_conversation',
      {
        user_id_1: userId1,
        user_id_2: userId2,
      }
    );

    if (error) {
      console.error('Error getting/creating conversation:', error);
      return { data: null, error };
    }

    // Fetch the full conversation data
    const { data: conversation, error: fetchError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (fetchError) {
      console.error('Error fetching conversation:', fetchError);
      return { data: null, error: fetchError };
    }

    return { data: mapConversationFromDB(conversation), error: null };
  } catch (e) {
    console.error('Unexpected error in getOrCreateConversation:', e);
    return { data: null, error: e };
  }
};