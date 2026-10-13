export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  last_seen: string;
};

export type Member = { user_id: string; last_read_at: string; role: string; profile: Profile };

export type Conversation = {
  id: string;
  is_group: boolean;
  name: string | null;
  avatar_url: string | null;
  last_message_at: string;
  members: Member[];
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  media_url: string | null;
  media_type: "image" | "video" | "audio" | "file" | null;
  reply_to: string | null;
  created_at: string;
};

export type Overview = {
  conversation_id: string;
  last_body: string | null;
  last_media_type: string | null;
  last_sender: string | null;
  last_at: string | null;
  unread: number;
};

export type Story = {
  id: string;
  user_id: string;
  media_url: string | null;
  caption: string;
  bg: string;
  created_at: string;
  expires_at: string;
  profile?: Profile;
};

export type Post = {
  id: string;
  user_id: string;
  image_url: string | null;
  caption: string;
  created_at: string;
  profile: Profile;
  likes: { user_id: string }[];
  comments: { id: string; body: string; created_at: string; user_id: string; profile: Profile }[];
};
