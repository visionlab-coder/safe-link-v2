"use client";
import RoleGuard from "@/components/RoleGuard";
import { useRouter } from "next/navigation";
import { Users, Nfc, ChevronRight } from "lucide-react";

const MENU = [
  {
    title: "근로자 관리",
    desc: "NFC 스티커 발급 대상 근로자를 등록·조회·관리합니다.",
    icon: Users,
    href: "/admin/workers",
    color: "from-blue-500 to-blue-700",
  },
  {
    title: "TBM NFC 참석 확인",
    desc: "TBM 세션을 개설하고 근로자 NFC 탭으로 실시간 참석을 확인합니다.",
    icon: Nfc,
    href: "/admin/tbm/live",
    color: "from-green-500 to-green-700",
  },
];

export default function AdminNfcHubPage() {
  const router = useRouter();

  return (
    <RoleGuard allowedRole="admin">
      <div className="min-h-screen bg-gray-950 text-white p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Nfc className="w-7 h-7 text-green-400" />
              <h1 className="text-2xl font-bold">NFC 관리</h1>
            </div>
            <p className="text-gray-400 text-sm">
              NFC 스티커 기반 TBM 참석 확인 시스템 (특허 출원)
            </p>
          </div>

          <div className="space-y-4">
            {MENU.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className="w-full bg-gray-800 hover:bg-gray-700 rounded-xl p-5 flex items-center gap-4 transition-all text-left border border-gray-700 hover:border-gray-500"
                >
                  <div className={`bg-gradient-to-br ${item.color} p-3 rounded-lg shrink-0`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white">{item.title}</div>
                    <div className="text-gray-400 text-sm mt-0.5 truncate">{item.desc}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500 shrink-0" />
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            <button
              onClick={() => router.back()}
              className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
            >
              ← 어드민으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
