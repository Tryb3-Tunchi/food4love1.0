"use client";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/useAuthStore";
import { submitKYC } from "@/services/kyc";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Shield, Video, FileText, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";

export default function KYCPage() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const updateStore = useAuthStore((s) => s.updateProfile);
  const [idDoc, setIdDoc] = useState("");
  const [faceVideo, setFaceVideo] = useState("");
  const [uploading, setUploading] = useState(false);
  const [idType, setIdType] = useState("nin");
  const { register, handleSubmit } = useForm<{ idNumber: string }>();

  const uploadFile = async (file: File, folder: string) => {
    const sb = createClient();
    const path = `${profile!.id}/${folder}/${Date.now()}-${file.name}`;
    await sb.storage.from("kyc-documents").upload(path, file);
    return sb.storage.from("kyc-documents").getPublicUrl(path).data.publicUrl;
  };

  const onDropId = useCallback(async (files: File[]) => {
    if (!files[0] || !profile) return;
    setUploading(true);
    try { setIdDoc(await uploadFile(files[0], "id-docs")); toast.success("ID uploaded"); }
    catch { toast.error("Upload failed"); } finally { setUploading(false); }
  }, [profile]);

  const onDropVideo = useCallback(async (files: File[]) => {
    if (!files[0] || !profile) return;
    setUploading(true);
    try { setFaceVideo(await uploadFile(files[0], "face-videos")); toast.success("Video uploaded"); }
    catch { toast.error("Upload failed"); } finally { setUploading(false); }
  }, [profile]);

  const idDz = useDropzone({ onDrop: onDropId, accept: { "image/*": [], "application/pdf": [] }, maxFiles: 1 });
  const vidDz = useDropzone({ onDrop: onDropVideo, accept: { "video/*": [] }, maxFiles: 1 });

  const submit = async (data: { idNumber: string }) => {
    if (!profile || !idDoc || !faceVideo) { toast.error("Please upload all documents"); return; }
    await submitKYC({ user_id: profile.id, full_name: profile.full_name ?? "", id_type: idType as any, id_number: data.idNumber, id_document_url: idDoc, face_video_url: faceVideo });
    updateStore({ kyc_status: "pending" });
    toast.success("Submitted! We will review within 24-48 hours.");
    router.push("/swipe");
  };

  return (
    <div className="flex min-h-screen flex-col bg-char px-5 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-sm mx-auto w-full">
        <div className="mb-6 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-pepper/10 border border-pepper/20 mb-4">
            <Shield className="h-8 w-8 text-pepper" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Verify your identity</h1>
          <p className="text-sm text-mist">You can browse while we review — but you need this to sell.</p>
        </div>
        <div className="rounded-xl border border-ember/20 bg-ember/5 p-3 mb-5">
          <p className="text-xs text-ember">⏱ Reviews take 24–48 hours. You can use the app in the meantime.</p>
        </div>
        <form onSubmit={handleSubmit(submit)} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-white mb-2 block">ID Type</label>
            <div className="grid grid-cols-2 gap-2">
              {["nin","bvn","passport","drivers_license"].map((t) => (
                <button key={t} type="button" onClick={() => setIdType(t)} className={`rounded-xl border px-3 py-2 text-xs font-medium transition-all ${idType === t ? "border-pepper bg-pepper/10 text-pepper" : "border-white/10 bg-coal text-mist"}`}>
                  {t.replace("_"," ").toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <Input label="ID Number" placeholder="Enter your ID number" {...register("idNumber", { required: true })} />
          <div>
            <label className="text-sm font-medium text-white mb-2 block">ID Document</label>
            <div {...idDz.getRootProps()} className={`rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-all ${idDoc ? "border-lime/40 bg-lime/5" : "border-white/10 hover:border-white/20"}`}>
              <input {...idDz.getInputProps()} />
              {idDoc ? <><CheckCircle className="h-6 w-6 text-lime mx-auto mb-1" /><p className="text-xs text-lime">Uploaded ✓</p></> : <><FileText className="h-6 w-6 text-mist mx-auto mb-1" /><p className="text-xs text-mist">Upload NIN, passport or license photo</p></>}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-white mb-2 block">Face Video <span className="text-pepper">*required</span></label>
            <div className="rounded-xl border border-ember/20 bg-ember/5 p-3 mb-2">
              <p className="text-xs text-ember">Record 5–10 seconds saying: <strong>"My name is [name] and I am a home chef on Food4Love"</strong></p>
            </div>
            <div {...vidDz.getRootProps()} className={`rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-all ${faceVideo ? "border-lime/40 bg-lime/5" : "border-white/10 hover:border-white/20"}`}>
              <input {...vidDz.getInputProps()} />
              {faceVideo ? <><CheckCircle className="h-6 w-6 text-lime mx-auto mb-1" /><p className="text-xs text-lime">Video uploaded ✓</p></> : <><Video className="h-6 w-6 text-mist mx-auto mb-1" /><p className="text-xs text-mist">MP4 or MOV, max 50MB</p></>}
            </div>
          </div>
          <Button type="submit" size="lg" className="w-full" loading={uploading} disabled={!idDoc || !faceVideo}>Submit for Review →</Button>
          <button type="button" onClick={() => router.push("/swipe")} className="w-full text-center text-sm text-mist hover:text-ash">Skip for now</button>
        </form>
      </motion.div>
    </div>
  );
}
