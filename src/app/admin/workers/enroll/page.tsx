"use client";

import { Suspense, useEffect, useState } from "react";
import RoleGuard from "@/components/RoleGuard";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle, Eraser, Nfc, ScanLine } from "lucide-react";
import { detectNfcSupport, eraseNfcTag, NfcError, readNfcUrl, writeNfcUrl } from "@/utils/nfc/web-nfc";
import Image from "next/image";
import VisualizationScreenLayout from "@/components/VisualizationScreenLayout";
import type { FeatureVisual } from "@/components/ResponsiveFeatureHero";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const ENROLL_UI: Record<string, Record<string, string>> = {
  ko: { invalid:"영문 이니셜과 휴대폰 번호 뒤 4자리를 입력하세요.", register:"근로자 등록에 실패했습니다.", issue:"NFC URL 발급에 실패했습니다.", noUrl:"아직 NFC URL이 발급되지 않았습니다.", write:"NFC 쓰기에 실패했습니다.", eraseUnsupported:"NFC 지우기는 HTTPS 환경의 Android Chrome에서 사용할 수 있습니다.", eraseConfirm:"이 NFC 카드를 지워 재사용 가능하게 하시겠습니까? 태그에 저장된 SQ Link URL이 삭제됩니다.", erase:"NFC 지우기에 실패했습니다.", readUnsupported:"NFC 읽기는 HTTPS 환경의 Android Chrome에서 사용할 수 있습니다.", read:"NFC 읽기에 실패했습니다.", ready:"URL 준비 완료", readyDesc:"지금은 NFC 카드를 가까이 대지 마세요. 먼저 쓰기 버튼을 누른 뒤, 휴대폰이 요청할 때 카드를 태그하세요.", writeCard:"NFC 카드에 쓰기", tag:"NFC 카드를 태그하세요", writingDesc:"근로자 카드를 휴대폰 가까이에 대면 SQ Link 접속 URL이 기록됩니다.", erasingDesc:"재사용할 카드를 휴대폰 가까이에 대면 저장된 SQ Link URL이 삭제됩니다.", readingDesc:"카드를 휴대폰 가까이에 대면 저장된 SQ Link URL을 읽습니다.", done:"카드 준비 완료", workerCode:"근로자 코드", workerList:"근로자 목록", next:"다음 카드", readCard:"카드 읽기", eraseCard:"카드 지우기", erased:"카드 지우기 완료", erasedDesc:"이 NFC 카드는 이제 다른 근로자에게 재배정할 수 있습니다.", retry:"다시 발급", failed:"NFC 작업 실패", retryAction:"다시 시도", reissue:"근로자 카드 재발급", enroll:"신규 근로자 등록", initials:"이름 이니셜", phone:"휴대폰 뒤 4자리", name:"근로자 이름", site:"현장 ID", back:"뒤로 가기", issueUrl:"NFC URL 발급", issueShort:"짧은 URL 발급" },
  en: { invalid:"Enter Roman initials and the last 4 phone digits.", register:"Worker registration failed.", issue:"Failed to issue NFC URL.", noUrl:"No NFC URL has been issued yet.", write:"Failed to write NFC.", eraseUnsupported:"NFC erase is available on Android Chrome over HTTPS.", eraseConfirm:"Erase this NFC card for reuse? The SQ Link URL stored on the tag will be removed.", erase:"Failed to erase NFC.", readUnsupported:"NFC reading is available on Android Chrome over HTTPS.", read:"Failed to read NFC.", ready:"URL ready", readyDesc:"Do not hold the card near the phone yet. Press write first, then tag the card when the phone requests it.", writeCard:"Write to NFC card", tag:"Tag the NFC card", writingDesc:"Hold the worker card near this phone to write the SQ Link URL.", erasingDesc:"Hold the reusable card near this phone to delete the saved SQ Link URL.", readingDesc:"Hold the card near this phone to read its saved SQ Link URL.", done:"Card ready", workerCode:"Worker code", workerList:"Worker list", next:"Next card", readCard:"Read card", eraseCard:"Erase card", erased:"Card erased", erasedDesc:"This NFC card can now be reassigned to another worker.", retry:"Issue again", failed:"NFC operation failed", retryAction:"Try again", reissue:"Reissue worker card", enroll:"Register worker", initials:"Name initials", phone:"Last 4 phone digits", name:"Worker name", site:"Site ID", back:"Go back", issueUrl:"Issue NFC URL", issueShort:"Issue short URL" },
  zh: { invalid:"请输入英文首字母和手机后 4 位。", register:"工人登记失败。", issue:"NFC 网址发放失败。", noUrl:"尚未发放 NFC 网址。", write:"NFC 写入失败。", eraseUnsupported:"NFC 擦除仅可在 HTTPS 环境的 Android Chrome 中使用。", eraseConfirm:"要擦除此 NFC 卡以便重复使用吗？标签中保存的 SQ Link 网址将被删除。", erase:"NFC 擦除失败。", readUnsupported:"NFC 读取仅可在 HTTPS 环境的 Android Chrome 中使用。", read:"NFC 读取失败。", ready:"网址准备完成", readyDesc:"暂时不要将卡靠近手机。请先点击写入，手机提示后再刷卡。", writeCard:"写入 NFC 卡", tag:"请刷 NFC 卡", writingDesc:"将工人卡靠近手机即可写入 SQ Link 网址。", erasingDesc:"将要重复使用的卡靠近手机即可删除已保存的网址。", readingDesc:"将卡靠近手机即可读取已保存的 SQ Link 网址。", done:"卡片准备完成", workerCode:"工人代码", workerList:"工人列表", next:"下一张卡", readCard:"读取卡", eraseCard:"擦除卡", erased:"卡片擦除完成", erasedDesc:"此 NFC 卡现在可重新分配给其他工人。", retry:"重新发放", failed:"NFC 操作失败", retryAction:"重试", reissue:"重新发放工人卡", enroll:"登记新工人", initials:"姓名首字母", phone:"电话后 4 位", name:"工人姓名", site:"现场 ID", back:"返回", issueUrl:"发放 NFC 网址", issueShort:"发放短网址" },
  vi: { invalid:"Hãy nhập chữ cái đầu La-tinh và 4 số cuối điện thoại.", register:"Đăng ký công nhân thất bại.", issue:"Không thể cấp URL NFC.", noUrl:"Chưa có URL NFC được cấp.", write:"Ghi NFC thất bại.", eraseUnsupported:"Chỉ có thể xóa NFC trên Android Chrome qua HTTPS.", eraseConfirm:"Xóa thẻ NFC này để tái sử dụng? URL SQ Link trên thẻ sẽ bị xóa.", erase:"Xóa NFC thất bại.", readUnsupported:"Chỉ có thể đọc NFC trên Android Chrome qua HTTPS.", read:"Đọc NFC thất bại.", ready:"URL đã sẵn sàng", readyDesc:"Chưa đưa thẻ lại gần điện thoại. Hãy nhấn ghi trước, rồi chạm thẻ khi điện thoại yêu cầu.", writeCard:"Ghi vào thẻ NFC", tag:"Chạm thẻ NFC", writingDesc:"Đưa thẻ công nhân lại gần điện thoại để ghi URL SQ Link.", erasingDesc:"Đưa thẻ cần tái sử dụng lại gần điện thoại để xóa URL SQ Link đã lưu.", readingDesc:"Đưa thẻ lại gần điện thoại để đọc URL SQ Link đã lưu.", done:"Thẻ đã sẵn sàng", workerCode:"Mã công nhân", workerList:"Danh sách công nhân", next:"Thẻ tiếp theo", readCard:"Đọc thẻ", eraseCard:"Xóa thẻ", erased:"Đã xóa thẻ", erasedDesc:"Thẻ NFC này có thể được gán lại cho công nhân khác.", retry:"Cấp lại", failed:"Thao tác NFC thất bại", retryAction:"Thử lại", reissue:"Cấp lại thẻ công nhân", enroll:"Đăng ký công nhân mới", initials:"Chữ cái đầu", phone:"4 số cuối điện thoại", name:"Tên công nhân", site:"ID công trường", back:"Quay lại", issueUrl:"Cấp URL NFC", issueShort:"Cấp URL ngắn" },
  ru: { invalid:"Введите латинские инициалы и последние 4 цифры телефона.", register:"Не удалось зарегистрировать работника.", issue:"Не удалось выдать NFC URL.", noUrl:"NFC URL ещё не выдан.", write:"Не удалось записать NFC.", eraseUnsupported:"Стирание NFC доступно в Android Chrome через HTTPS.", eraseConfirm:"Стереть эту NFC-карту для повторного использования? URL SQ Link на метке будет удалён.", erase:"Не удалось стереть NFC.", readUnsupported:"Чтение NFC доступно в Android Chrome через HTTPS.", read:"Не удалось прочитать NFC.", ready:"URL готов", readyDesc:"Пока не подносите карту к телефону. Сначала нажмите запись, затем приложите карту по запросу телефона.", writeCard:"Записать на NFC-карту", tag:"Приложите NFC-карту", writingDesc:"Поднесите карту работника к телефону, чтобы записать URL SQ Link.", erasingDesc:"Поднесите карту для повторного использования к телефону, чтобы удалить сохранённый URL SQ Link.", readingDesc:"Поднесите карту к телефону, чтобы прочитать сохранённый URL SQ Link.", done:"Карта готова", workerCode:"Код работника", workerList:"Список работников", next:"Следующая карта", readCard:"Прочитать карту", eraseCard:"Стереть карту", erased:"Карта стёрта", erasedDesc:"Эту NFC-карту можно назначить другому работнику.", retry:"Выдать снова", failed:"Операция NFC не удалась", retryAction:"Повторить", reissue:"Перевыпустить карту работника", enroll:"Зарегистрировать работника", initials:"Инициалы", phone:"Последние 4 цифры", name:"Имя работника", site:"ID объекта", back:"Назад", issueUrl:"Выдать NFC URL", issueShort:"Выдать короткий URL" },
};

const ONBOARDING_VISUAL: Record<string, FeatureVisual> = {
  ko: { image:"onboarding", eyebrow:"QUICK ONBOARDING", title:"신규 · QR 근로자 등록", description:"최소 정보와 현장 코드로 빠르게 시작", metrics:[{label:"신규 등록",value:"18명"},{label:"확인 완료",value:"16명"},{label:"평균 시간",value:"52초"}], steps:[{title:"QR 접속",description:"별도 앱 없이 시작"},{title:"정보 입력",description:"이름·생년월일·전화번호"},{title:"현장 승인",description:"관리자 확인 후 입장"}] },
  en: { image:"onboarding", eyebrow:"QUICK ONBOARDING", title:"New · QR worker registration", description:"Start quickly with minimum information and a site code", metrics:[{label:"New registrations",value:"18"},{label:"Verified",value:"16"},{label:"Average time",value:"52 sec"}], steps:[{title:"Open QR",description:"Start without a separate app"},{title:"Enter details",description:"Name, date of birth, phone number"},{title:"Site approval",description:"Enter after administrator confirmation"}] },
  zh: { image:"onboarding", eyebrow:"快速登记", title:"新建 · QR 工人登记", description:"通过最少信息和现场代码快速开始", metrics:[{label:"新增登记",value:"18人"},{label:"确认完成",value:"16人"},{label:"平均时间",value:"52秒"}], steps:[{title:"打开 QR",description:"无需单独应用即可开始"},{title:"输入信息",description:"姓名、出生日期、电话号码"},{title:"现场批准",description:"管理员确认后进入"}] },
  vi: { image:"onboarding", eyebrow:"ĐĂNG KÝ NHANH", title:"Mới · Đăng ký công nhân QR", description:"Bắt đầu nhanh với thông tin tối thiểu và mã công trường", metrics:[{label:"Đăng ký mới",value:"18 người"},{label:"Đã xác minh",value:"16 người"},{label:"Thời gian trung bình",value:"52 giây"}], steps:[{title:"Mở QR",description:"Bắt đầu không cần ứng dụng riêng"},{title:"Nhập thông tin",description:"Tên, ngày sinh, số điện thoại"},{title:"Duyệt công trường",description:"Vào sau khi quản trị viên xác nhận"}] },
  ru: { image:"onboarding", eyebrow:"БЫСТРАЯ РЕГИСТРАЦИЯ", title:"Новая · регистрация работника по QR", description:"Быстрый старт с минимальными данными и кодом объекта", metrics:[{label:"Новые регистрации",value:"18 чел."},{label:"Подтверждено",value:"16 чел."},{label:"Среднее время",value:"52 сек."}], steps:[{title:"Открыть QR",description:"Начните без отдельного приложения"},{title:"Ввести данные",description:"Имя, дата рождения, номер телефона"},{title:"Подтверждение объекта",description:"Вход после подтверждения администратора"}] },
};

const ENROLL_GUIDANCE: Record<string, { minimum: string; warningTitle: string; warning: string }> = {
  ko: { minimum:"카드 라벨과 향후 ERP 매칭을 위해 필요한 최소 정보만 입력합니다. 근로자는 카드 태그 후 국가와 언어를 직접 선택합니다.", warningTitle:"현장 확인", warning:"이 화면에서 태그하라고 안내하기 전까지 카드를 가까이 대지 마세요. 계속 실패하면 NFC Tools로 카드를 NDEF 형식으로 초기화하거나 아래 대체 URL을 기록하세요." },
  en: { minimum:"Enter only the minimum information needed for the card label and future ERP matching. Workers choose their country and language after tapping the card.", warningTitle:"Site check", warning:"Do not hold the card near the device until this screen asks you to tap it. If it keeps failing, initialize the card as NDEF with NFC Tools or record the alternative URL below." },
  zh: { minimum:"仅输入卡片标签和后续 ERP 匹配所需的最少信息。工人刷卡后可直接选择国家和语言。", warningTitle:"现场确认", warning:"在此页面提示刷卡前，请勿将卡片靠近设备。若持续失败，请使用 NFC Tools 将卡片初始化为 NDEF 格式，或记录下方备用网址。" },
  vi: { minimum:"Chỉ nhập thông tin tối thiểu cần cho nhãn thẻ và đối chiếu ERP sau này. Công nhân tự chọn quốc gia và ngôn ngữ sau khi chạm thẻ.", warningTitle:"Kiểm tra công trường", warning:"Không đưa thẻ gần thiết bị cho đến khi màn hình này yêu cầu chạm thẻ. Nếu lỗi tiếp diễn, hãy khởi tạo thẻ dạng NDEF bằng NFC Tools hoặc ghi lại URL thay thế bên dưới." },
  ru: { minimum:"Введите только минимальные данные для маркировки карты и будущего сопоставления с ERP. После прикладывания карты работник сам выбирает страну и язык.", warningTitle:"Проверка объекта", warning:"Не подносите карту к устройству, пока этот экран не попросит приложить её. Если ошибка повторяется, инициализируйте карту как NDEF в NFC Tools или сохраните альтернативный URL ниже." },
};

type Step = "form" | "ready" | "writing" | "reading" | "erasing" | "done" | "erased" | "error";

const DEFAULT_WORKER_PROFILE = {
  nationality: "KR",
  trade: "general",
  preferred_lang: "ko",
};

function WorkerEnrollInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = useDisplayLanguage();
  const t = ENROLL_UI[lang] || ENROLL_UI.en;
  const guidance = ENROLL_GUIDANCE[lang] || ENROLL_GUIDANCE.en;
  const existingWorkerId = searchParams.get("worker_id");
  const nfcSupport = detectNfcSupport();

  const [step, setStep] = useState<Step>("form");
  const [fullName, setFullName] = useState("");
  const [nameInitials, setNameInitials] = useState("");
  const [phoneLast4, setPhoneLast4] = useState("");
  const [siteId, setSiteId] = useState("");
  const [error, setError] = useState("");
  const [stickerUrl, setStickerUrl] = useState("");
  const [stickerId, setStickerId] = useState("");
  const [issuedWorkerId, setIssuedWorkerId] = useState("");
  const [workerCode, setWorkerCode] = useState("");
  const [readPayload, setReadPayload] = useState("");

  useEffect(() => {
    // P6 박제: createBrowserClient 의존 제거. /api/auth/me 단일화.
    const loadAdminSite = async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as { profile?: { site_id?: string | null } | null };
        const currentSiteId = data.profile?.site_id;
        if (currentSiteId) setSiteId(currentSiteId);
      } catch { /* unauthenticated → RoleGuard 가 처리 */ }
    };
    loadAdminSite();
  }, []);

  const resetForm = () => {
    setStep("form");
    setFullName("");
    setNameInitials("");
    setPhoneLast4("");
    setError("");
    setStickerUrl("");
    setStickerId("");
    setIssuedWorkerId("");
    setWorkerCode("");
    setReadPayload("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    let workerId = existingWorkerId;

    if (!workerId) {
      // 🟢 V2 NFC 간편 등록: 영문 이니셜 + 전화번호 뒷 4자리.
      // full_name 은 옵션. 입력 없으면 이니셜 그대로 사용 (서버에서 처리).
      const cleanInitials = nameInitials.trim().replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase();
      const cleanLast4 = phoneLast4.trim().replace(/\D/g, "").slice(-4);
      if (!cleanInitials || cleanLast4.length !== 4) {
        setError(t.invalid);
        return;
      }
      const name = fullName.trim() || cleanInitials;

      const res = await fetch("/api/nfc/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: name,
          name_initials: cleanInitials,
          phone_last4: cleanLast4,
          assigned_site_id: siteId || undefined,
          consent_signed_at: new Date().toISOString(),
          ...DEFAULT_WORKER_PROFILE,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(`${data.error || t.register}${data.detail ? `: ${data.detail}` : ""}`);
        return;
      }
      workerId = data.id;
      setWorkerCode(data.worker_code);
    }

    const issueRes = await fetch("/api/nfc/sticker/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worker_id: workerId, revoke_previous: true }),
    });
    const issueData = await issueRes.json();
    if (!issueRes.ok) {
      setError(issueData.detail || issueData.error || t.issue);
      return;
    }

    setStickerUrl(issueData.url);
    setStickerId(issueData.sticker_id || "");
    setIssuedWorkerId(workerId || "");
    if (!workerCode) setWorkerCode(issueData.worker.worker_code);

    setStep(nfcSupport.supported ? "ready" : "done");
  };

  const handleWriteNfc = async () => {
    if (!stickerUrl) {
      setError(t.noUrl);
      setStep("form");
      return;
    }
    setError("");
    setStep("writing");
    try {
      await writeNfcUrl(stickerUrl);
      setStep("done");
    } catch (err) {
      if (err instanceof NfcError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : t.write);
      }
      setStep("error");
    }
  };

  const handleEraseNfc = async () => {
    if (!nfcSupport.supported) {
      setError(t.eraseUnsupported);
      setStep("error");
      return;
    }
    if (!confirm(t.eraseConfirm)) return;
    setError("");
    setStep("erasing");
    try {
      await eraseNfcTag();
      const eventRes = await fetch("/api/nfc/sticker/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "erased",
          worker_id: issuedWorkerId || existingWorkerId || undefined,
          sticker_id: stickerId || undefined,
          reason: "card_reuse",
          metadata: { source: "admin_workers_enroll" },
        }),
      });
      const eventData = await eventRes.json();
      if (!eventRes.ok) throw new Error(eventData.detail || eventData.error || "NFC 지우기 기록 저장에 실패했습니다.");
      setStep("erased");
    } catch (err) {
      if (err instanceof NfcError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : t.erase);
      }
      setStep("error");
    }
  };

  const handleReadNfc = async () => {
    if (!nfcSupport.supported) {
      setError(t.readUnsupported);
      setStep("error");
      return;
    }
    setError("");
    setReadPayload("");
    setStep("reading");
    try {
      const result = await readNfcUrl();
      setReadPayload(result.rawPayload);
      setStep("form");
    } catch (err) {
      if (err instanceof NfcError) {
        setError(`${err.code}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : t.read);
      }
      setStep("error");
    }
  };

  if (step === "ready") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-gray-800 rounded-xl p-8 max-w-sm w-full text-center border border-gray-700">
          <Nfc className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">{t.ready}</h2>
          <p className="text-gray-400 text-sm mb-4">
            {t.readyDesc}
          </p>
          <p className="text-gray-500 text-xs break-all bg-gray-900 p-3 rounded-lg mb-4">{stickerUrl}</p>
          <button
            type="button"
            onClick={handleWriteNfc}
            className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Nfc className="w-4 h-4" />
            {t.writeCard}
          </button>
        </div>
      </div>
    );
  }

  if (step === "writing") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-gray-800 rounded-xl p-8 max-w-sm w-full text-center border border-gray-700">
          <Nfc className="w-16 h-16 text-green-400 mx-auto mb-4 animate-pulse" />
          <h2 className="text-white text-xl font-bold mb-2">{t.tag}</h2>
          <p className="text-gray-400 text-sm">{t.writingDesc}</p>
        </div>
      </div>
    );
  }

  if (step === "erasing") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-gray-800 rounded-xl p-8 max-w-sm w-full text-center border border-gray-700">
          <Eraser className="w-16 h-16 text-yellow-400 mx-auto mb-4 animate-pulse" />
          <h2 className="text-white text-xl font-bold mb-2">{t.tag}</h2>
          <p className="text-gray-400 text-sm">{t.erasingDesc}</p>
        </div>
      </div>
    );
  }

  if (step === "reading") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-gray-800 rounded-xl p-8 max-w-sm w-full text-center border border-gray-700">
          <ScanLine className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-pulse" />
          <h2 className="text-white text-xl font-bold mb-2">{t.tag}</h2>
          <p className="text-gray-400 text-sm">{t.readingDesc}</p>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-gray-800 rounded-xl p-8 max-w-sm w-full text-center border border-gray-700">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">{t.done}</h2>
          <p className="text-gray-400 text-sm">
            {t.workerCode}: <span className="text-white font-mono">{workerCode}</span>
          </p>
          <p className="text-gray-500 text-xs mt-3">
            실물 카드에는 근로자 이름을 표시하세요. 태그에는 서명된 SQ Link URL만 저장됩니다.
          </p>
          {stickerUrl && (
            <div className="bg-white p-3 rounded-xl mt-4">
              <Image
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(stickerUrl)}`}
                alt="근로자 SQ Link QR"
                width={220}
                height={220}
                unoptimized
                className="mx-auto"
              />
            </div>
          )}
          <p className="text-gray-400 text-xs mt-3">
            NFC 인식이 어려울 때 근로자가 이 QR을 스캔할 수 있습니다.
          </p>
          {!nfcSupport.supported && (
            <div className="bg-gray-900 rounded-lg p-3 mt-4">
              <p className="text-yellow-300 text-xs mb-1">이 기기에서는 Web NFC 쓰기를 사용할 수 없습니다. QR/NFC 인코딩용 대체 URL을 사용하세요.</p>
              <p className="text-gray-400 text-xs break-all">{stickerUrl}</p>
            </div>
          )}
          <div className="flex gap-3 mt-5">
            <button onClick={() => router.push("/admin/workers")} className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm transition-colors">
              {t.workerList}
            </button>
            {!existingWorkerId && (
              <button onClick={resetForm} className="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded-lg text-sm transition-colors">
                {t.next}
              </button>
            )}
          </div>
          {nfcSupport.supported && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <button
                onClick={handleReadNfc}
                className="bg-blue-800 hover:bg-blue-700 text-white py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                <ScanLine className="w-4 h-4" />
                {t.readCard}
              </button>
              <button
                onClick={handleEraseNfc}
                className="bg-yellow-700 hover:bg-yellow-600 text-white py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Eraser className="w-4 h-4" />
                {t.eraseCard}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === "erased") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-gray-800 rounded-xl p-8 max-w-sm w-full text-center border border-gray-700">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">{t.erased}</h2>
          <p className="text-gray-400 text-sm">{t.erasedDesc}</p>
          <div className="flex gap-3 mt-5">
            <button onClick={() => router.push("/admin/workers")} className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm transition-colors">
              {t.workerList}
            </button>
            <button onClick={resetForm} className="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded-lg text-sm transition-colors">
              {t.retry}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-gray-800 rounded-xl p-8 max-w-sm w-full text-center border border-gray-700">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">{t.failed}</h2>
          {error && <p className="text-red-300 text-sm mb-4">{error}</p>}
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3 mb-4 text-left">
            <p className="text-yellow-200 text-xs font-semibold mb-1">{guidance.warningTitle}</p>
            <p className="text-yellow-100 text-xs">
              {guidance.warning}
            </p>
          </div>
          <p className="text-gray-500 text-xs break-all bg-gray-900 p-3 rounded-lg">{stickerUrl}</p>
          <button onClick={() => setStep(stickerUrl ? "ready" : "form")} className="mt-4 w-full bg-blue-600 hover:bg-blue-500 py-2 rounded-lg text-sm transition-colors">
            {t.retryAction}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eef3f8] p-4 text-[#111827] md:p-8">
      <div className="max-w-lg mx-auto">
        <VisualizationScreenLayout
          visual={ONBOARDING_VISUAL[lang] || ONBOARDING_VISUAL.en}
          action={<button type="submit" form="worker-enroll-form">{existingWorkerId ? t.reissue : t.enroll}</button>}
        >
        <form id="worker-enroll-form" onSubmit={handleSubmit} className="space-y-4">
          {!existingWorkerId && (
            <>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-sm text-gray-300">
                  {guidance.minimum}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">{t.initials} *</label>
                  <input
                    required
                    value={nameInitials}
                    onChange={(event) => setNameInitials(event.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase())}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 uppercase"
                    placeholder="KDH"
                    maxLength={4}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">{t.phone} *</label>
                  <input
                    required
                    value={phoneLast4}
                    onChange={(event) => setPhoneLast4(event.target.value.replace(/\D/g, "").slice(-4))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                    placeholder="1234"
                    inputMode="numeric"
                    maxLength={4}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">{t.name} *</label>
                <input
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                  placeholder="카드에 표시할 이름"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">{t.site}</label>
                <input
                  value={siteId}
                  onChange={(event) => setSiteId(event.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
                  placeholder="관리자 현장 ID"
                />
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}
          {readPayload && (
            <div className="bg-blue-950/50 border border-blue-800 rounded-lg px-4 py-3 text-blue-200 text-xs">
              <p className="font-semibold mb-1">읽기 결과</p>
              <p className="break-all font-mono">{readPayload}</p>
            </div>
          )}

          {!nfcSupport.supported && (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg px-4 py-3 text-yellow-300 text-sm">
              이 기기에서는 Web NFC 쓰기를 사용할 수 없습니다. HTTPS 환경의 Android Chrome이 필요합니다. 대신 QR/NFC 대체용 짧은 URL은 발급됩니다.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => router.back()} className="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded-xl font-medium transition-colors">
              {t.back}
            </button>
            <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
              {nfcSupport.supported ? <><Nfc className="w-4 h-4" /> {t.issueUrl}</> : t.issueShort}
            </button>
          </div>
          {nfcSupport.supported && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleReadNfc}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-700 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <ScanLine className="w-4 h-4" />
                {t.readCard}
              </button>
              <button
                type="button"
                onClick={handleEraseNfc}
                className="bg-yellow-800 hover:bg-yellow-700 border border-yellow-700 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Eraser className="w-4 h-4" />
                {t.eraseCard}
              </button>
            </div>
          )}
        </form>
        </VisualizationScreenLayout>
      </div>
    </div>
  );
}

export default function WorkerEnrollPage() {
  return (
    <RoleGuard allowedRole="admin">
      <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center"><p className="text-gray-500">불러오는 중...</p></div>}>
        <WorkerEnrollInner />
      </Suspense>
    </RoleGuard>
  );
}
