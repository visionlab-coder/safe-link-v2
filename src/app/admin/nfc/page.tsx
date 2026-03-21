"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import { createClient } from "@/utils/supabase/client";
import { sites } from "@/constants";
import { NFC_TAG_TYPES, generateNfcUrl } from "@/utils/nfc/constants";

interface NfcTag {
  id: string;
  tag_code: string;
  site_id: string | null;
  location: string | null;
  tag_type: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminNfcPage() {
  const router = useRouter();
  const [tags, setTags] = useState<NfcTag[]>([]);
  const [loading, setLoading] = useState(true);

  // New tag form
  const [newTagCode, setNewTagCode] = useState("");
  const [newSiteId, setNewSiteId] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newTagType, setNewTagType] = useState<string>(NFC_TAG_TYPES.CHECK_IN);
  const [creating, setCreating] = useState(false);

  const supabase = createClient();

  const loadTags = async () => {
    const { data } = await supabase
      .from("nfc_tags")
      .select("*")
      .order("created_at", { ascending: false });
    setTags(data || []);
    setLoading(false);
  };

  useEffect(() => { loadTags(); }, []);

  const handleCreateTag = async () => {
    if (!newTagCode.trim()) return;
    setCreating(true);

    const { error } = await supabase.from("nfc_tags").insert({
      tag_code: newTagCode.trim(),
      site_id: newSiteId || null,
      location: newLocation.trim() || null,
      tag_type: newTagType,
    });

    if (error) {
      alert("Error: " + error.message);
    } else {
      setNewTagCode("");
      setNewLocation("");
      await loadTags();
    }
    setCreating(false);
  };

  const handleToggleActive = async (tag: NfcTag) => {
    await supabase
      .from("nfc_tags")
      .update({ is_active: !tag.is_active })
      .eq("id", tag.id);
    await loadTags();
  };

  const generateAutoCode = () => {
    const prefix = newTagType === NFC_TAG_TYPES.CONFIRM ? "CONFIRM" : "GATE";
    const site = newSiteId || "SITE";
    const num = String(tags.length + 1).padStart(2, "0");
    setNewTagCode(`TAG-${site}-${prefix}-${num}`);
  };

  return (
    <RoleGuard allowedRole="admin">
      <div className="min-h-screen bg-mesh text-white p-4 md:p-8 font-sans">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <header className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-black tracking-tighter italic text-gradient">NFC Tag Management</h1>
              <p className="text-slate-500 font-bold mt-1">SAFE-LINK v2.5</p>
            </div>
            <button
              onClick={() => router.push("/admin")}
              className="px-4 py-2 glass-card rounded-full text-xs font-black text-slate-400 hover:text-white transition-colors"
            >
              ← Back
            </button>
          </header>

          {/* Create Tag */}
          <section className="glass-card rounded-3xl p-6 mb-8">
            <h2 className="text-xl font-black text-white mb-4">Create NFC Tag</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 tracking-wider uppercase block mb-1">Tag Code</label>
                <div className="flex gap-2">
                  <input
                    value={newTagCode}
                    onChange={(e) => setNewTagCode(e.target.value)}
                    placeholder="TAG-SITE001-GATE-01"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold placeholder:text-slate-700 focus:border-blue-500/50 outline-none"
                  />
                  <button
                    onClick={generateAutoCode}
                    className="px-3 py-3 bg-blue-600/20 text-blue-400 rounded-xl text-xs font-black hover:bg-blue-600/30 transition-colors"
                  >
                    Auto
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 tracking-wider uppercase block mb-1">Site</label>
                <select
                  value={newSiteId}
                  onChange={(e) => setNewSiteId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:border-blue-500/50 outline-none"
                >
                  <option value="">-- Select Site --</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 tracking-wider uppercase block mb-1">Location</label>
                <input
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="정문 출입구, 확인존 A..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold placeholder:text-slate-700 focus:border-blue-500/50 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 tracking-wider uppercase block mb-1">Tag Type</label>
                <select
                  value={newTagType}
                  onChange={(e) => setNewTagType(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:border-blue-500/50 outline-none"
                >
                  <option value="check_in">Check-in (출석)</option>
                  <option value="confirm">Confirm (TBM 확인)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleCreateTag}
              disabled={!newTagCode.trim() || creating}
              className="w-full py-4 bg-gradient-to-br from-blue-400 to-blue-600 text-slate-950 font-black rounded-2xl text-lg transition-all tap-effect disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Tag"}
            </button>
          </section>

          {/* Tags List */}
          <section>
            <h2 className="text-xl font-black text-white mb-4">
              Registered Tags <span className="text-slate-600">({tags.length})</span>
            </h2>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : tags.length === 0 ? (
              <div className="glass-card rounded-3xl p-8 text-center text-slate-500 font-bold">
                No tags registered yet
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {tags.map((tag) => {
                  const url = generateNfcUrl(tag.tag_code, tag.tag_type as any);
                  const siteName = sites.find(s => s.id === tag.site_id)?.name;

                  return (
                    <div key={tag.id} className={`glass-card rounded-2xl p-4 transition-all ${!tag.is_active ? "opacity-40" : ""}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider ${
                              tag.tag_type === "confirm"
                                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            }`}>
                              {tag.tag_type === "confirm" ? "CONFIRM" : "CHECK-IN"}
                            </span>
                            {tag.is_active && (
                              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            )}
                          </div>
                          <p className="text-white font-black text-lg truncate">{tag.tag_code}</p>
                          {siteName && <p className="text-slate-500 text-xs font-bold">{siteName}</p>}
                          {tag.location && <p className="text-slate-600 text-xs font-bold">{tag.location}</p>}
                          <p className="text-slate-700 text-[10px] font-mono mt-1 truncate">{url}</p>
                        </div>

                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <button
                            onClick={() => { navigator.clipboard.writeText(url); }}
                            className="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-[10px] font-black hover:bg-blue-600/30 transition-colors"
                          >
                            Copy URL
                          </button>
                          <button
                            onClick={() => handleToggleActive(tag)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-colors ${
                              tag.is_active
                                ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                : "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                            }`}
                          >
                            {tag.is_active ? "Disable" : "Enable"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </RoleGuard>
  );
}
