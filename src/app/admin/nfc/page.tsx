"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import RoleGuard from "@/components/RoleGuard";
import { useRouter } from "next/navigation";
import { ChevronRight, ClipboardList, KeyRound, LocateFixed, Nfc, RefreshCw, Users } from "lucide-react";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const MENU_META = [
  {
    icon: Users,
    href: "/admin/workers",
    color: "from-blue-500 to-blue-700",
  },
  {
    icon: Nfc,
    href: "/admin/tbm/live",
    color: "from-green-500 to-green-700",
  },
  {
    icon: ClipboardList,
    href: "/admin/nfc/daily-logs",
    color: "from-amber-500 to-orange-700",
  },
];

const NFC_UI: Record<string, Record<string, string | string[]>> = {
  ko: { title:"NFC 관리", desc:"카드 발급, TBM 참석, 안전일지와 현장 확인코드를 관리합니다.", mySite:"내 현장", selectSite:"현장 선택...", missingSite:"프로필 현장명 필요", siteCode:"현장코드", saveLocation:"현장 위치 저장", noGeolocation:"이 기기에서는 위치 정보를 사용할 수 없습니다.", saveLocationFailed:"현장 위치 저장에 실패했습니다.", locationSaved:"현재 스마트폰 위치가 현장 위치로 저장되었습니다.", allowLocation:"위치 권한을 허용한 뒤 다시 시도하세요.", workerAccess:"근로자 SQ Link 기능", accessInfo:"꺼짐 상태에서는 TBM 태그와 근로자 NFC 진입이 차단됩니다.", state:"현재 상태", enabled:"켜짐", disabled:"꺼짐", confirmEnable:"근로자 SQ Link 기능을 다시 켜시겠습니까?", confirmDisable:"현장 근로자 SQ Link 모든 기능을 중지하시겠습니까?", accessFailed:"현장 기능 상태 변경에 실패했습니다.", accessEnabled:"근로자 기능을 켰습니다.", accessDisabled:"근로자 기능을 중지했습니다.", challenge:"오늘 현장 확인코드", challengeInfo:"근로자는 NFC 태깅 후 이 6자리 코드를 입력해야 출근/퇴근이 확정됩니다.", reissue:"재발급", create:"생성", expires:"만료", challengeFailed:"확인코드 생성 실패", challengeRenewed:"오늘 확인코드를 새로 발급했습니다.", challengeReady:"오늘 확인코드를 준비했습니다.", back:"뒤로 가기", menuTitles:["근로자 NFC 관리", "TBM NFC 참석 확인", "NFC 일일 안전일지"], menuDescs:["근로자 등록, NFC 카드 발급, 재발급, 지우기를 관리합니다.", "TBM 세션을 열고 근로자 NFC 태깅으로 참석과 서명을 확인합니다.", "퇴근 태깅으로 자동 업로드된 출근, 퇴근, TBM 서명 기록을 확인합니다."] },
  en: { title:"NFC Management", desc:"Manage card issuance, TBM attendance, safety logs, and site verification codes.", mySite:"My site", selectSite:"Select a site...", missingSite:"Site name is required in the profile", siteCode:"Site code", saveLocation:"Save site location", noGeolocation:"Location is unavailable on this device.", saveLocationFailed:"Failed to save the site location.", locationSaved:"The current smartphone location has been saved as the site location.", allowLocation:"Allow location permission and try again.", workerAccess:"Worker SQ Link access", accessInfo:"When disabled, TBM tagging and worker NFC entry are blocked.", state:"Current status", enabled:"Enabled", disabled:"Disabled", confirmEnable:"Enable worker SQ Link features again?", confirmDisable:"Stop all SQ Link features for workers at this site?", accessFailed:"Failed to change site feature status.", accessEnabled:"Worker features have been enabled.", accessDisabled:"Worker features have been disabled.", challenge:"Today’s site verification code", challengeInfo:"Workers must enter this 6-digit code after NFC tagging to confirm check-in/out.", reissue:"Reissue", create:"Create", expires:"Expires", challengeFailed:"Failed to create verification code", challengeRenewed:"Today’s verification code has been reissued.", challengeReady:"Today’s verification code is ready.", back:"Go back", menuTitles:["Worker NFC Management", "TBM NFC Attendance", "NFC Daily Safety Log"], menuDescs:["Manage worker registration, NFC card issue, reissue, and removal.", "Open a TBM session and verify attendance and signatures with worker NFC tags.", "Review check-in, check-out, and TBM signature records uploaded when workers tag out."] },
  zh: { title:"NFC 管理", desc:"管理卡片发放、TBM 出席、安全日志和现场确认码。", mySite:"我的现场", selectSite:"选择现场...", missingSite:"个人资料需要现场名称", siteCode:"现场代码", saveLocation:"保存现场位置", noGeolocation:"此设备无法使用位置信息。", saveLocationFailed:"保存现场位置失败。", locationSaved:"当前手机位置已保存为现场位置。", allowLocation:"请允许位置权限后重试。", workerAccess:"工人 SQ Link 功能", accessInfo:"关闭后将阻止 TBM 刷卡和工人 NFC 进入。", state:"当前状态", enabled:"已开启", disabled:"已关闭", confirmEnable:"要重新开启工人 SQ Link 功能吗？", confirmDisable:"要停止该现场工人的所有 SQ Link 功能吗？", accessFailed:"现场功能状态更改失败。", accessEnabled:"工人功能已开启。", accessDisabled:"工人功能已停止。", challenge:"今日现场确认码", challengeInfo:"工人 NFC 刷卡后必须输入此 6 位代码才能确认上下班。", reissue:"重新发放", create:"生成", expires:"到期", challengeFailed:"确认码生成失败", challengeRenewed:"已重新发放今日确认码。", challengeReady:"今日确认码已准备好。", back:"返回", menuTitles:["工人 NFC 管理", "TBM NFC 出席确认", "NFC 每日安全日志"], menuDescs:["管理工人登记、NFC 卡发放、补发和删除。", "创建 TBM 会话并通过工人 NFC 刷卡确认出席和签名。", "查看下班刷卡时自动上传的上下班和 TBM 签名记录。"] },
  vi: { title:"Quản lý NFC", desc:"Quản lý cấp thẻ, tham gia TBM, nhật ký an toàn và mã xác nhận công trường.", mySite:"Công trường của tôi", selectSite:"Chọn công trường...", missingSite:"Cần tên công trường trong hồ sơ", siteCode:"Mã công trường", saveLocation:"Lưu vị trí công trường", noGeolocation:"Thiết bị này không thể dùng vị trí.", saveLocationFailed:"Không thể lưu vị trí công trường.", locationSaved:"Vị trí điện thoại hiện tại đã được lưu làm vị trí công trường.", allowLocation:"Hãy cho phép vị trí rồi thử lại.", workerAccess:"Chức năng SQ Link cho công nhân", accessInfo:"Khi tắt, quét TBM và vào NFC của công nhân sẽ bị chặn.", state:"Trạng thái hiện tại", enabled:"Đã bật", disabled:"Đã tắt", confirmEnable:"Bật lại chức năng SQ Link cho công nhân?", confirmDisable:"Dừng tất cả chức năng SQ Link cho công nhân tại công trường này?", accessFailed:"Không thể thay đổi trạng thái chức năng công trường.", accessEnabled:"Đã bật chức năng cho công nhân.", accessDisabled:"Đã dừng chức năng cho công nhân.", challenge:"Mã xác nhận công trường hôm nay", challengeInfo:"Công nhân phải nhập mã 6 chữ số này sau khi quét NFC để xác nhận vào/ra làm.", reissue:"Cấp lại", create:"Tạo", expires:"Hết hạn", challengeFailed:"Không thể tạo mã xác nhận", challengeRenewed:"Đã cấp lại mã xác nhận hôm nay.", challengeReady:"Mã xác nhận hôm nay đã sẵn sàng.", back:"Quay lại", menuTitles:["Quản lý NFC công nhân", "Xác nhận tham gia TBM bằng NFC", "Nhật ký an toàn NFC hằng ngày"], menuDescs:["Quản lý đăng ký công nhân, cấp, cấp lại và xóa thẻ NFC.", "Mở phiên TBM và xác nhận tham gia, chữ ký bằng thẻ NFC của công nhân.", "Xem bản ghi vào, ra và chữ ký TBM được tải lên khi quét ra về."] },
  ru: { title:"Управление NFC", desc:"Управляйте выдачей карт, участием в TBM, журналами безопасности и кодами подтверждения объекта.", mySite:"Мой объект", selectSite:"Выберите объект...", missingSite:"В профиле требуется название объекта", siteCode:"Код объекта", saveLocation:"Сохранить местоположение", noGeolocation:"На этом устройстве недоступна геолокация.", saveLocationFailed:"Не удалось сохранить местоположение объекта.", locationSaved:"Текущее местоположение смартфона сохранено как местоположение объекта.", allowLocation:"Разрешите доступ к местоположению и попробуйте снова.", workerAccess:"Функции SQ Link для работников", accessInfo:"При отключении блокируются отметки TBM и вход работников через NFC.", state:"Текущий статус", enabled:"Включено", disabled:"Отключено", confirmEnable:"Снова включить функции SQ Link для работников?", confirmDisable:"Остановить все функции SQ Link для работников на этом объекте?", accessFailed:"Не удалось изменить статус функций объекта.", accessEnabled:"Функции для работников включены.", accessDisabled:"Функции для работников остановлены.", challenge:"Код подтверждения объекта на сегодня", challengeInfo:"После отметки NFC работники должны ввести этот 6-значный код для подтверждения прихода/ухода.", reissue:"Выдать повторно", create:"Создать", expires:"Истекает", challengeFailed:"Не удалось создать код подтверждения", challengeRenewed:"Код подтверждения на сегодня выдан повторно.", challengeReady:"Код подтверждения на сегодня готов.", back:"Назад", menuTitles:["Управление NFC работников", "Подтверждение участия TBM по NFC", "Ежедневный журнал безопасности NFC"], menuDescs:["Управляйте регистрацией работников, выдачей, перевыпуском и удалением NFC-карт.", "Откройте сессию TBM и подтвердите участие и подписи с помощью NFC-меток работников.", "Просматривайте записи прихода, ухода и подписей TBM, загруженные при отметке ухода."] },
};

const NFC_LOCALES: Record<string, string> = { ko:"ko-KR", en:"en-US", zh:"zh-CN", vi:"vi-VN", ru:"ru-RU" };

type SiteOption = {
  id: string;
  name: string;
  site_code?: string | null;
};

type Challenge = {
  challenge_code: string;
  work_date: string;
  expires_at: string;
};

export default function AdminNfcHubPage() {
  const router = useRouter();
  const lang = useDisplayLanguage();
  const t = NFC_UI[lang] || NFC_UI.en;
  const locale = NFC_LOCALES[lang] || NFC_LOCALES.en;
  const menuTitles = t.menuTitles as string[];
  const menuDescs = t.menuDescs as string[];
  const [siteName, setSiteName] = useState("");
  const [siteCode, setSiteCode] = useState("");
  const [mySiteId, setMySiteId] = useState<string | null>(null);
  const [siteList, setSiteList] = useState<SiteOption[]>([]);
  const [locationStatus, setLocationStatus] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [challengeStatus, setChallengeStatus] = useState("");
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [siteAccessEnabled, setSiteAccessEnabled] = useState(true);
  const [siteAccessStatus, setSiteAccessStatus] = useState("");

  const fetchChallenge = useCallback(async (siteId?: string | null) => {
    const qs = siteId ? `?site_id=${encodeURIComponent(siteId)}` : "";
    const res = await fetch(`/api/nfc/site-challenge${qs}`);
    if (!res.ok) return;
    const data = await res.json();
    setChallenge(data.challenge ?? null);
  }, []);

  const fetchSiteAccess = useCallback(async (siteId?: string | null) => {
    const qs = siteId ? `?site_id=${encodeURIComponent(siteId)}` : "";
    const res = await fetch(`/api/nfc/site-access-control${qs}`);
    if (!res.ok) return;
    const data = await res.json();
    setSiteAccessEnabled(data.control?.is_enabled !== false);
  }, []);

  useEffect(() => {
    const loadContext = async () => {
      const [meRes, sitesRes] = await Promise.all([
        fetch("/api/auth/me", { cache: "no-store", credentials: "include" }),
        fetch("/api/sites/options", { cache: "no-store", credentials: "include" }),
      ]);
      if (!meRes.ok) return;
      const me = await meRes.json() as { profile?: { site_id?: string | null; site_code?: string | null } | null };
      const sitesBody = sitesRes.ok ? await sitesRes.json() as { sites?: SiteOption[] } : {};
      const sites = sitesBody.sites ?? [];
      const siteId = me.profile?.site_id ?? null;
      if (siteId) {
        const site = sites.find((item) => String(item.id) === String(siteId));
        setMySiteId(siteId);
        setSiteName(site?.name ?? me.profile?.site_code ?? "");
        setSiteCode(site?.site_code ?? me.profile?.site_code ?? "");
        fetchChallenge(siteId);
        fetchSiteAccess(siteId);
      } else {
        setSiteList(sites);
        setChallenge(null);
      }
    };
    loadContext().catch(() => undefined);
  }, [fetchChallenge, fetchSiteAccess]);

  const saveCurrentSiteLocation = async () => {
    setLocationStatus("");
    if (!navigator.geolocation) {
      setLocationStatus(t.noGeolocation as string);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const res = await fetch("/api/sites/current-location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            site_id: mySiteId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            geofence_radius_m: 300,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setLocationStatus(data.error || t.saveLocationFailed as string);
          return;
        }
        setLocationStatus(t.locationSaved as string);
        if (data.site?.name) setSiteName(data.site.name);
        if (data.site?.site_code) setSiteCode(data.site.site_code);
      },
      () => setLocationStatus(t.allowLocation as string),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  const selectSite = (id: string) => {
    const site = siteList.find((s) => s.id === id);
    if (site) {
      setMySiteId(id);
      setSiteName(site.name);
      setSiteCode(site.site_code ?? "");
      fetchChallenge(id);
      fetchSiteAccess(id);
    }
  };

  const toggleSiteAccess = async () => {
    const nextEnabled = !siteAccessEnabled;
    const message = nextEnabled
      ? t.confirmEnable as string
      : t.confirmDisable as string;
    if (!window.confirm(message)) return;
    setSiteAccessStatus("");
    const res = await fetch("/api/nfc/site-access-control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        site_id: mySiteId,
        is_enabled: nextEnabled,
        reason: nextEnabled ? "admin_enabled" : "admin_disabled",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSiteAccessStatus(data.error || t.accessFailed as string);
      return;
    }
    setSiteAccessEnabled(data.control?.is_enabled !== false);
    setSiteAccessStatus(nextEnabled ? t.accessEnabled as string : t.accessDisabled as string);
  };

  const createChallenge = async (rotate = false) => {
    setChallengeLoading(true);
    setChallengeStatus("");
    try {
      const res = await fetch("/api/nfc/site-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotate, ...(mySiteId ? { site_id: mySiteId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || t.challengeFailed as string);
      setChallenge(data.challenge);
      setChallengeStatus(rotate ? t.challengeRenewed as string : t.challengeReady as string);
    } catch (err) {
      setChallengeStatus(err instanceof Error ? err.message : t.challengeFailed as string);
    } finally {
      setChallengeLoading(false);
    }
  };

  return (
    <RoleGuard allowedRole="admin">
      <main className="visualization-light min-h-screen p-6">
        <section className="max-w-2xl mx-auto">
          <div className="concept-page-header">
            <span className="font-black tracking-tight text-[#063789]">SQ-LINK</span>
          </div>
          <div className="mb-8">
            <div className="admin-concept-hero relative rounded-2xl overflow-hidden h-40 w-full mt-4">
              <picture>
                <source media="(max-width: 639px)" srcSet="/images/mobile-v3/android/nfc-qr.webp" />
                <Image src="/images/mobile-v3/website/nfc-qr.webp" alt={t.title as string} fill className="object-cover" priority />
              </picture>
              <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-slate-950/15" />
              <div className="absolute inset-x-0 bottom-0 z-10 p-5 text-white sm:p-8">
                <p className="text-[10px] font-black tracking-[.18em] text-green-200">SQ-LINK NFC</p>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{t.title as string}</h1>
                <p className="mt-2 text-sm font-bold text-slate-100">{t.desc as string}</p>
              </div>
            </div>
          </div>

          <div id="nfc-site-section" className="mb-5 bg-white border border-[#d9e1ea] rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500">{t.mySite as string}</p>
                {!mySiteId && siteList.length > 0 ? (
                  <select
                    className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    value=""
                    onChange={(e) => selectSite(e.target.value)}
                  >
                    <option value="" disabled>{t.selectSite as string}</option>
                    {siteList.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm font-semibold text-white truncate">{siteName || t.missingSite as string}</p>
                )}
                {siteCode && <p className="text-xs font-mono text-green-300 mt-1">{t.siteCode as string} {siteCode}</p>}
              </div>
              {mySiteId && (
                <button
                  type="button"
                  onClick={saveCurrentSiteLocation}
                  className="shrink-0 bg-green-700 hover:bg-green-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <LocateFixed className="w-4 h-4" />
                  {t.saveLocation as string}
                </button>
              )}
            </div>
            {locationStatus && <p className="text-xs text-gray-400 mt-3">{locationStatus}</p>}
          </div>

          <div className="mb-5 bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">{t.workerAccess as string}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {t.accessInfo as string}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleSiteAccess}
                className={`relative h-8 w-14 rounded-full transition-colors ${siteAccessEnabled ? "bg-green-600" : "bg-gray-700"}`}
                aria-label="Toggle worker SQ Link access"
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-transform ${siteAccessEnabled ? "translate-x-7" : "translate-x-1"}`}
                />
              </button>
            </div>
            <p className={`text-xs mt-3 ${siteAccessEnabled ? "text-green-300" : "text-yellow-300"}`}>
              {t.state as string}: {siteAccessEnabled ? t.enabled as string : t.disabled as string}
            </p>
            {siteAccessStatus && <p className="text-xs text-gray-400 mt-2">{siteAccessStatus}</p>}
          </div>

          <div className="mb-5 bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <p className="text-sm font-semibold">{t.challenge as string}</p>
                </div>
                <p className="text-xs text-gray-500">
                  {t.challengeInfo as string}
                </p>
              </div>
              <button
                type="button"
                disabled={challengeLoading}
                onClick={() => createChallenge(Boolean(challenge))}
                className="shrink-0 bg-amber-700 hover:bg-amber-600 disabled:bg-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {challenge ? t.reissue as string : t.create as string}
              </button>
            </div>
            <div className="mt-4 rounded-lg bg-gray-950 border border-gray-800 px-4 py-5 text-center">
              <p className="font-mono text-4xl font-black tracking-[0.35em] text-white">
                {challenge?.challenge_code ?? "------"}
              </p>
              {challenge?.expires_at && (
                <p className="text-xs text-gray-500 mt-2">
                  {t.expires as string}: {new Date(challenge.expires_at).toLocaleString(locale)}
                </p>
              )}
            </div>
            {challengeStatus && <p className="text-xs text-gray-400 mt-3">{challengeStatus}</p>}
          </div>

          <div className="space-y-4">
            {MENU_META.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => router.push(item.href)}
                  className="w-full bg-gray-800 hover:bg-gray-700 rounded-xl p-5 flex items-center gap-4 transition-all text-left border border-gray-700 hover:border-gray-500"
                >
                  <div className={`bg-gradient-to-br ${item.color} p-3 rounded-lg shrink-0`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white">{menuTitles[index]}</div>
                    <div className="text-gray-400 text-sm mt-0.5">{menuDescs[index]}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500 shrink-0" />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => router.back()}
            className="mt-6 text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            {t.back as string}
          </button>
        </section>
      </main>
    </RoleGuard>
  );
}
