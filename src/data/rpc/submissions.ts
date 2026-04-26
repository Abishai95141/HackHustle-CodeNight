import { supabase } from '@/data/client';

const BUCKET = 'submissions';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const MAX_BYTES = 50 * 1024 * 1024;

function validateFile(file: File): string | null {
  if (!ALLOWED_MIME.has(file.type)) return 'Only PDF or PPT files are allowed.';
  if (file.size > MAX_BYTES) return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB > 50 MB).`;
  if (file.size === 0) return 'Empty file.';
  return null;
}

function extOf(file: File): string {
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'application/vnd.ms-powerpoint') return 'ppt';
  if (file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'pptx';
  // Fallback: take from the filename.
  const dot = file.name.lastIndexOf('.');
  return dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : 'bin';
}

export async function uploadDeck(teamId: string, file: File) {
  const err = validateFile(file);
  if (err) throw new Error(err);

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user) throw new Error('Not signed in');

  const path = `${teamId}/deck.${extOf(file)}`;

  // Replace any prior object at this path.
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: '0',
  });
  if (upErr) throw upErr;

  // Upsert the submission row. Storage policies already gate the upload to the
  // team's own folder, so the team_id we write here matches the bucket prefix
  // RLS allowed in the storage write above.
  const { error: rowErr } = await supabase.from('submissions').upsert(
    {
      team_id: teamId,
      deck_path: path,
      deck_filename: file.name,
      deck_mime: file.type,
      deck_size_bytes: file.size,
      updated_by: user.id,
    },
    { onConflict: 'team_id' },
  );
  if (rowErr) throw rowErr;

  return path;
}

export async function deleteDeck(teamId: string, path: string) {
  const { error: rmErr } = await supabase.storage.from(BUCKET).remove([path]);
  if (rmErr) throw rmErr;
  const { error: rowErr } = await supabase
    .from('submissions')
    .update({
      deck_path: null,
      deck_filename: null,
      deck_mime: null,
      deck_size_bytes: null,
    })
    .eq('team_id', teamId);
  if (rowErr) throw rowErr;
}

export async function setGithubUrl(teamId: string, githubUrl: string | null) {
  const trimmed = (githubUrl ?? '').trim();
  if (trimmed && !/^https?:\/\//i.test(trimmed)) {
    throw new Error('GitHub URL must start with http:// or https://');
  }
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('submissions').upsert(
    {
      team_id: teamId,
      github_url: trimmed || null,
      updated_by: user?.id ?? null,
    },
    { onConflict: 'team_id' },
  );
  if (error) throw error;
}

/** Time-limited signed URL for downloading the deck. */
export async function signDeckUrl(path: string, expiresIn = 60 * 10): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
