"use client";
import { useEffect, useState } from "react";
import { getKYCSubmissions, reviewKYC } from "@/services/kyc";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import toast from "react-hot-toast";

export default function AdminKYCPage() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<string | null>(null);

  useEffect(() => { getKYCSubmissions("pending").then(setSubmissions).finally(() => setLoading(false)); }, []);

  const handle = async (id: string, userId: string, approved: boolean, reason?: string) => {
    setReviewing(id);
    try {
      await reviewKYC(id, userId, approved, reason);
      setSubmissions((p) => p.filter((s) => s.id !== id));
      toast.success(approved ? "Chef verified ✓" : "Submission rejected");
    } catch { toast.error("Failed to update"); } finally { setReviewing(null); }
  };

  return (
    <div className="min-h-screen bg-char p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">KYC Review Queue</h1>
      <p className="text-mist mb-6">Review chef video verifications before they can sell</p>
      {loading ? <p className="text-mist">Loading...</p> : !submissions.length ? (
        <div className="rounded-2xl bg-smoke border border-white/5 p-12 text-center"><p className="text-4xl mb-3">✅</p><p className="text-white font-semibold">All clear! No pending submissions.</p></div>
      ) : (
        <div className="space-y-4">
          {submissions.map((s) => (
            <div key={s.id} className="rounded-2xl bg-smoke border border-white/5 p-5">
              <div className="flex items-start gap-4 mb-4">
                <Avatar src={s.user?.avatar_url} name={s.full_name} size="lg" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-white">{s.full_name}</span>
                    <Badge variant="muted" size="sm">{s.id_type?.toUpperCase()}</Badge>
                  </div>
                  <p className="text-sm text-ash">ID: {s.id_number}</p>
                  <p className="text-xs text-mist mt-0.5">Submitted {new Date(s.submitted_at).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {s.id_document_url && (
                  <a href={s.id_document_url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-coal p-3 text-sm text-white hover:border-white/20 transition-all">
                    📄 View ID Document
                  </a>
                )}
                {s.face_video_url && (
                  <a href={s.face_video_url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-ember/30 bg-ember/10 p-3 text-sm text-ember hover:border-ember/50 transition-all">
                    🎥 Watch KYC Video
                  </a>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="primary" size="sm" className="flex-1 bg-lime hover:bg-lime/90 shadow-none" loading={reviewing === s.id} onClick={() => handle(s.id, s.user_id, true)}>✓ Approve & Verify</Button>
                <Button variant="danger" size="sm" className="flex-1" loading={reviewing === s.id} onClick={() => { const r = prompt("Rejection reason (shown to chef):"); if (r) handle(s.id, s.user_id, false, r); }}>✕ Reject</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
