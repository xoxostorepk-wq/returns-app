import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import RequestDetail from '@/components/RequestDetail';

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single();
  const { data: request } = await supabase.from('requests').select('*').eq('id', params.id).single();

  if (!request) notFound();

  const [{ data: images }, { data: comments }, { data: timeline }, { data: profiles }] = await Promise.all([
    supabase.from('request_images').select('*').eq('request_id', params.id).order('uploaded_at'),
    supabase.from('request_comments').select('*').eq('request_id', params.id).order('created_at'),
    supabase.from('request_timeline').select('*').eq('request_id', params.id).order('created_at'),
    supabase.from('profiles').select('*'),
  ]);

  // Signed URLs so images are viewable without making the storage bucket public.
  const imagesWithUrls = await Promise.all(
    (images ?? []).map(async (img) => {
      const { data } = await supabase.storage
        .from('request-images')
        .createSignedUrl(img.storage_path, 60 * 60);
      return { ...img, url: data?.signedUrl ?? '' };
    })
  );

  const profilesById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  return (
    <RequestDetail
      request={request}
      images={imagesWithUrls}
      comments={comments ?? []}
      timeline={timeline ?? []}
      profilesById={profilesById}
      currentProfile={profile!}
    />
  );
}
