export interface GuildInvitationRecord {
  id: string;
  invite_id: string;
  guild_id: string;
  inviter_id: string;
  invitee_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  created_at: Date;
}

export interface GuildMemberRecordNew {
  id: string;
  guild_id: string;
  node_id: string;
  role: 'owner' | 'admin' | 'moderator' | 'member';
  joined_at: Date;
}
