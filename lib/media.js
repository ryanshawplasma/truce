/**
 * Photos in Our corner — the bits both sides of the wire need.
 *
 * Deliberately free of `server-only` and of any Node import: the room's
 * composer (a client component) needs the same limits and the same idea of what
 * a media path looks like as the server action that checks one.
 *
 * WHERE PHOTOS LIVE
 * -----------------
 * A private Supabase Storage bucket called `corner-media`, one folder per room:
 *
 *     corner-media/<roomId>/<nanoid>.jpg
 *
 * The bucket has no public policies at all. Nothing reads it except the service
 * role, from the server, and browsers only ever see short-lived signed URLs.
 * That means a photo cannot be found by guessing, and a link someone forwards
 * stops working within the hour.
 */

/** Bucket name. Must match the one created in the Supabase dashboard. */
export const MEDIA_BUCKET = 'corner-media';

/** Biggest ORIGINAL we will even try to compress. Bigger than this is a fair
 *  bet it is a video, a RAW file, or a mistake. */
export const MEDIA_MAX_ORIGINAL_BYTES = 12 * 1024 * 1024;

/** What we aim for after compression. Phone photos land well under this. */
export const MEDIA_TARGET_BYTES = 800 * 1024;

/** Longest edge after resizing. 1600px still looks good full-screen. */
export const MEDIA_MAX_EDGE = 1600;

/** Hard ceiling on what we will upload, even if compression fought back. */
export const MEDIA_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** Captions are short on purpose — this is a chat, not an album. */
export const MEDIA_CAPTION_MAX = 200;

/** How long a signed download URL lasts. Re-signed on every fetch. */
export const MEDIA_SIGNED_TTL_SECONDS = 60 * 60;

/** Uploads per hour, per side of a room. */
export const MEDIA_UPLOADS_PER_HOUR = 12;

/** Most photos the gallery will ever ask for in one go. */
export const MEDIA_GALLERY_LIMIT = 200;

/** Everything we are willing to read from a file picker. */
export const MEDIA_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif';

/**
 * The one sentence shown when the site owner has not made the bucket (or has
 * not added the media_path column) yet. Deliberately blames nobody in the room.
 */
export const MEDIA_SETUP_MESSAGE = 'Photos need one quick setup step by the site owner 🤍';

export const MEDIA_TOO_BIG_MESSAGE = 'That photo is over 12MB — try a smaller one 🤍';
export const MEDIA_NOT_IMAGE_MESSAGE = 'That needs to be a photo — jpg, png, webp or gif.';
export const MEDIA_BROKEN_MESSAGE = 'That photo could not be read. Try another one?';
export const MEDIA_THROTTLE_MESSAGE = 'That is a lot of photos in one hour — give it a little while 🤍';

/** `<roomId>/<id>.jpg` */
export function mediaPathFor(roomId, id) {
  return `${roomId}/${id}.jpg`;
}

/**
 * Is this a path this room is allowed to record?
 *
 * The client tells the server which object it just uploaded, and a client can
 * say anything. Two independent things have to hold:
 *
 *   1. the first segment is EXACTLY the caller's own room id — so one corner
 *      can never attach a photo out of another corner, even if it somehow
 *      learned the path;
 *   2. the rest is the shape we generate — one folder deep, a nanoid stem, a
 *      .jpg suffix, nothing else.
 *
 * Both segments are matched against a strict allowlist of characters, so `..`,
 * a leading `/`, a query string and a percent-escape are all impossible rather
 * than merely unlikely.
 */
export function isPlausibleMediaPath(path, roomId) {
  if (typeof path !== 'string' || typeof roomId !== 'string' || !roomId) return false;
  if (path.length > 120) return false;

  const parts = path.split('/');
  if (parts.length !== 2) return false;

  const [folder, file] = parts;
  if (folder !== roomId) return false;              // own room only
  if (!/^[A-Za-z0-9]{6,32}$/.test(folder)) return false;
  if (!/^[A-Za-z0-9_-]{6,40}\.jpg$/.test(file)) return false;

  return true;
}

/** Something to show while a photo is arriving, without measuring the file. */
export function prettyBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
