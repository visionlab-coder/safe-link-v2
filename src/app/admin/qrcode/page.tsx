"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Shield, Users, ArrowLeft, Download, QrCode, Nfc, CheckCircle, AlertCircle, UserPlus } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { detectNfcSupport, writeNfcUrl, NfcError } from "@/utils/nfc/web-nfc";
import { QRCodeCanvas } from "qrcode.react";
import { useDisplayLanguage } from "@/hooks/useDisplayLanguage";

const QR_UI: Record<string, Record<string, string>> = {
    ko: { title:"출입 관리 센터", desc:"QR 배포 · NFC 카드 발급 통합", siteSettings:"현장 설정", siteDesc:"선택한 현장이 QR과 NFC 카드 모두에 자동 적용됩니다.", loadingSites:"현장 목록 불러오는 중...", selectedSite:"선택된 현장", noSite:"연결된 현장이 없습니다. 프로필에서 현장명을 먼저 입력해주세요.", profile:"프로필 설정 →", qrDownloadFailed:"QR 이미지 다운로드에 실패했습니다.", urlCopyFailed:"URL 복사에 실패했습니다.", adminQr:"관리자 / 안전관리자 QR", adminQrDesc:"현장에 부착합니다. 관리자가 스캔하면 역할과 현장 ID를 함께 전달합니다.", workerQr:"근로자 QR", workerQrDesc:"현장에 부착합니다. 근로자가 스캔하면 역할 선택 없이 바로 로그인 화면으로 진입합니다.", qrDistribution:"QR 배포 (현장 부착용)", download:"다운로드", copied:"URL 복사됨" },
    en: { title:"Access Center", desc:"QR distribution · NFC card issuance", siteSettings:"Site settings", siteDesc:"The selected site is applied automatically to both QR codes and NFC cards.", loadingSites:"Loading sites...", selectedSite:"Selected site", noSite:"No site is connected. Enter a site name in the profile first.", profile:"Profile settings →", qrDownloadFailed:"Failed to download QR image.", urlCopyFailed:"Failed to copy URL.", adminQr:"Administrator / safety manager QR", adminQrDesc:"Post it on site. When an administrator scans it, the role and site ID are passed together.", workerQr:"Worker QR", workerQrDesc:"Post it on site. When a worker scans it, they enter the sign-in screen without role selection.", qrDistribution:"QR distribution (for posting on site)", download:"Download", copied:"URL copied" },
    zh: { title:"出入管理中心", desc:"二维码分发 · NFC 卡发放", siteSettings:"现场设置", siteDesc:"所选现场会自动应用到二维码和 NFC 卡。", loadingSites:"正在加载现场列表...", selectedSite:"已选择现场", noSite:"没有关联现场。请先在个人资料中输入现场名称。", profile:"个人资料设置 →", qrDownloadFailed:"二维码图片下载失败。", urlCopyFailed:"网址复制失败。", adminQr:"管理员 / 安全管理员二维码", adminQrDesc:"张贴在现场。管理员扫描后会同时传递角色和现场 ID。", workerQr:"工人二维码", workerQrDesc:"张贴在现场。工人扫描后无需选择角色即可进入登录页面。", qrDistribution:"二维码分发（现场张贴用）", download:"下载", copied:"网址已复制" },
    vi: { title:"Trung tâm quản lý ra vào", desc:"Phân phối QR · cấp thẻ NFC", siteSettings:"Thiết lập công trường", siteDesc:"Công trường đã chọn tự động áp dụng cho cả QR và thẻ NFC.", loadingSites:"Đang tải danh sách công trường...", selectedSite:"Công trường đã chọn", noSite:"Chưa có công trường được liên kết. Hãy nhập tên công trường trong hồ sơ trước.", profile:"Cài đặt hồ sơ →", qrDownloadFailed:"Không thể tải ảnh QR.", urlCopyFailed:"Không thể sao chép URL.", adminQr:"QR quản trị viên / quản lý an toàn", adminQrDesc:"Dán tại công trường. Khi quản trị viên quét, vai trò và ID công trường được truyền cùng nhau.", workerQr:"QR công nhân", workerQrDesc:"Dán tại công trường. Khi công nhân quét, họ vào màn hình đăng nhập mà không cần chọn vai trò.", qrDistribution:"Phân phối QR (để dán tại công trường)", download:"Tải xuống", copied:"Đã sao chép URL" },
    ru: { title:"Центр управления доступом", desc:"Распространение QR · выдача NFC-карт", siteSettings:"Настройки объекта", siteDesc:"Выбранный объект автоматически применяется к QR-кодам и NFC-картам.", loadingSites:"Загрузка списка объектов...", selectedSite:"Выбранный объект", noSite:"Нет подключённого объекта. Сначала укажите название объекта в профиле.", profile:"Настройки профиля →", qrDownloadFailed:"Не удалось скачать изображение QR.", urlCopyFailed:"Не удалось скопировать URL.", adminQr:"QR администратора / менеджера безопасности", adminQrDesc:"Разместите на объекте. При сканировании администратором передаются роль и ID объекта.", workerQr:"QR работника", workerQrDesc:"Разместите на объекте. При сканировании работником сразу открывается вход без выбора роли.", qrDistribution:"Распространение QR (для размещения на объекте)", download:"Скачать", copied:"URL скопирован" },
};

const NFC_ISSUE_UI: Record<string, Record<string, string>> = {
    ko: { nameRequired:"근로자 이름을 입력해주세요.", identityRequired:"영문 이니셜과 휴대전화 번호 뒤 4자리를 입력해주세요.", registerFailed:"근로자 등록에 실패했습니다.", missingId:"근로자 등록 응답에 ID가 없습니다. 다시 시도해주세요.", urlFailed:"URL 발급 실패", urlRetry:"URL 발급 실패. 다시 시도해주세요.", permission:"NFC 권한이 거부됐습니다. Chrome 주소창 왼쪽 자물쇠 → 사이트 설정 → NFC 허용 후 다시 시도하세요.", writeFailed:"쓰기 실패", title:"NFC 근로자 카드 발급", subtitle:"이름 입력 → NFC 태그 쓰기. 근로자는 터치 후 국적만 선택합니다.", name:"근로자 이름 (카드 라벨용)", initials:"이니셜 (로마자, 필수)", phone:"전화 뒷자리 (필수)", processing:"처리 중...", issueWrite:"발급 + NFC 쓰기", issueUrl:"URL 발급", unsupported:"이 기기는 Web NFC를 지원하지 않습니다. (Android Chrome + HTTPS 필요) URL만 발급됩니다." },
    en: { nameRequired:"Enter the worker name.", identityRequired:"Enter Roman initials and the last 4 phone digits.", registerFailed:"Worker registration failed.", missingId:"Worker registration returned no ID. Please try again.", urlFailed:"Failed to issue URL", urlRetry:"Failed to issue URL. Please try again.", permission:"NFC permission was denied. Allow NFC in Chrome site settings and try again.", writeFailed:"Write failed", title:"Issue NFC Worker Card", subtitle:"Enter a name → write an NFC tag. The worker selects only nationality after tapping.", name:"Worker name (card label)", initials:"Initials (Roman, required)", phone:"Last phone digits (required)", processing:"Processing...", issueWrite:"Issue + write NFC", issueUrl:"Issue URL", unsupported:"This device does not support Web NFC. (Android Chrome + HTTPS required) Only a URL will be issued." },
    zh: { nameRequired:"请输入工人姓名。", identityRequired:"请输入英文首字母和手机后 4 位。", registerFailed:"工人登记失败。", missingId:"工人登记响应中没有 ID，请重试。", urlFailed:"网址发放失败", urlRetry:"网址发放失败，请重试。", permission:"NFC 权限被拒绝。请在 Chrome 网站设置中允许 NFC 后重试。", writeFailed:"写入失败", title:"发放 NFC 工人卡", subtitle:"输入姓名 → 写入 NFC 标签。工人刷卡后只需选择国籍。", name:"工人姓名（卡片标签）", initials:"首字母（罗马字，必填）", phone:"电话后几位（必填）", processing:"正在处理...", issueWrite:"发放并写入 NFC", issueUrl:"发放网址", unsupported:"此设备不支持 Web NFC。（需要 Android Chrome + HTTPS）仅发放网址。" },
    vi: { nameRequired:"Hãy nhập tên công nhân.", identityRequired:"Hãy nhập chữ cái đầu La-tinh và 4 số cuối điện thoại.", registerFailed:"Đăng ký công nhân thất bại.", missingId:"Phản hồi đăng ký công nhân không có ID. Hãy thử lại.", urlFailed:"Không thể cấp URL", urlRetry:"Không thể cấp URL. Hãy thử lại.", permission:"Quyền NFC bị từ chối. Hãy cho phép NFC trong cài đặt trang Chrome và thử lại.", writeFailed:"Ghi thất bại", title:"Cấp thẻ NFC công nhân", subtitle:"Nhập tên → ghi thẻ NFC. Công nhân chỉ chọn quốc tịch sau khi chạm thẻ.", name:"Tên công nhân (nhãn thẻ)", initials:"Chữ cái đầu (La-tinh, bắt buộc)", phone:"Số cuối điện thoại (bắt buộc)", processing:"Đang xử lý...", issueWrite:"Cấp + ghi NFC", issueUrl:"Cấp URL", unsupported:"Thiết bị này không hỗ trợ Web NFC. (Cần Android Chrome + HTTPS) Chỉ URL được cấp." },
    ru: { nameRequired:"Введите имя работника.", identityRequired:"Введите латинские инициалы и последние 4 цифры телефона.", registerFailed:"Не удалось зарегистрировать работника.", missingId:"В ответе регистрации нет ID. Повторите попытку.", urlFailed:"Не удалось выдать URL", urlRetry:"Не удалось выдать URL. Повторите попытку.", permission:"Доступ NFC запрещён. Разрешите NFC в настройках сайта Chrome и попробуйте снова.", writeFailed:"Ошибка записи", title:"Выдача NFC-карты работника", subtitle:"Введите имя → запишите NFC-метку. После касания работник выбирает только гражданство.", name:"Имя работника (метка карты)", initials:"Инициалы (латиница, обязательно)", phone:"Последние цифры телефона (обязательно)", processing:"Обработка...", issueWrite:"Выдать + записать NFC", issueUrl:"Выдать URL", unsupported:"Это устройство не поддерживает Web NFC. (Нужны Android Chrome + HTTPS) Будет выдан только URL." },
};

const NFC_FLOW_UI: Record<string, Record<string, string>> = {
    ko: { privacy:"이니셜과 전화 뒷자리는 NFC URL의 단축 ID 힌트로만 사용되는 최소 식별 데이터입니다.", ready:"URL 발급 완료", one:"① 카드를 휴대전화에서 떼어놓으세요", two:"② 아래 버튼을 누르면 휴대전화가 NFC 쓰기 대기 모드로 전환됩니다", three:"③ NFC 준비 알림이 뜨면 카드를 가까이 대세요", permission:"처음 실행하면 Chrome이 NFC 권한을 요청합니다. 반드시 ‘허용’을 눌러야 합니다.", write:"NFC 카드에 쓰기", tap:"NFC 카드를 기기에 가까이 대세요", writing:"URL을 기록 중입니다...", done:"카드 발급 완료", failed:"NFC 쓰기 실패", code:"근로자 코드", issued:"발급 URL (QR 출력 가능)", fallback:"위 URL을 QR 코드로 출력하거나 별도 NFC 라이터로 기록하세요.", retry:"다시 쓰기", next:"다음 카드 발급", print:"QR 출력", workerFooter:"근로자 QR: 스캔 시 역할 선택 없이 바로 로그인. NFC 터치: 국적만 선택하면 완료.", adminFooter:"관리자 QR: 현장 소장/안전관리자용. 스캔 후 역할 선택 화면이 표시됩니다." },
    en: { privacy:"Initials and phone digits are used only as a short ID hint in the NFC URL; they are minimum identification data.", ready:"URL issued", one:"① Move the card away from the phone", two:"② Press the button below to put the phone into NFC writing standby", three:"③ When the NFC-ready notice appears, hold the card close", permission:"On first use, Chrome requests NFC permission. You must select ‘Allow’.", write:"Write to NFC card", tap:"Hold the NFC card close to the device", writing:"Writing URL...", done:"Card issued", failed:"NFC write failed", code:"Worker code", issued:"Issued URL (QR printable)", fallback:"Print the URL as a QR code or write it with a separate NFC writer.", retry:"Write again", next:"Issue next card", print:"Print QR", workerFooter:"Worker QR: sign in immediately without role selection. NFC tap: select nationality only.", adminFooter:"Administrator QR: for site managers/safety managers. A role-selection screen appears after scanning." },
    zh: { privacy:"首字母和电话尾号仅作为 NFC URL 的短 ID 提示使用，是最少的识别数据。", ready:"网址发放完成", one:"① 将卡片移离手机", two:"② 点击下方按钮，手机将进入 NFC 写入待机模式", three:"③ 出现 NFC 就绪提示后，将卡片靠近", permission:"首次使用时 Chrome 会请求 NFC 权限，必须选择“允许”。", write:"写入 NFC 卡", tap:"请将 NFC 卡靠近设备", writing:"正在写入网址...", done:"卡片发放完成", failed:"NFC 写入失败", code:"工人代码", issued:"已发放网址（可打印二维码）", fallback:"请将上述网址打印为二维码或用单独的 NFC 写入器写入。", retry:"重新写入", next:"发放下一张卡", print:"打印二维码", workerFooter:"工人二维码：扫描后无需选择角色即可登录。NFC 刷卡：只需选择国籍。", adminFooter:"管理员二维码：供现场负责人/安全管理员使用。扫描后显示角色选择页面。" },
    vi: { privacy:"Chữ cái đầu và số cuối điện thoại chỉ dùng làm gợi ý ID ngắn trong URL NFC, là dữ liệu nhận diện tối thiểu.", ready:"Đã cấp URL", one:"① Để thẻ cách xa điện thoại", two:"② Nhấn nút bên dưới để điện thoại vào chế độ chờ ghi NFC", three:"③ Khi có thông báo NFC sẵn sàng, đưa thẻ lại gần", permission:"Lần đầu dùng, Chrome sẽ yêu cầu quyền NFC. Bạn phải chọn ‘Cho phép’.", write:"Ghi vào thẻ NFC", tap:"Đưa thẻ NFC lại gần thiết bị", writing:"Đang ghi URL...", done:"Đã cấp thẻ", failed:"Ghi NFC thất bại", code:"Mã công nhân", issued:"URL đã cấp (có thể in QR)", fallback:"Hãy in URL trên thành mã QR hoặc ghi bằng thiết bị ghi NFC riêng.", retry:"Ghi lại", next:"Cấp thẻ tiếp theo", print:"In QR", workerFooter:"QR công nhân: đăng nhập ngay không cần chọn vai trò. Chạm NFC: chỉ chọn quốc tịch.", adminFooter:"QR quản trị viên: dành cho chỉ huy công trường/quản lý an toàn. Màn hình chọn vai trò xuất hiện sau khi quét." },
    ru: { privacy:"Инициалы и цифры телефона используются только как подсказка короткого ID в URL NFC; это минимальные данные идентификации.", ready:"URL выдан", one:"① Уберите карту от телефона", two:"② Нажмите кнопку ниже — телефон перейдёт в режим ожидания записи NFC", three:"③ Когда появится уведомление о готовности NFC, поднесите карту", permission:"При первом использовании Chrome запросит разрешение NFC. Обязательно выберите «Разрешить».", write:"Записать на NFC-карту", tap:"Поднесите NFC-карту к устройству", writing:"Запись URL...", done:"Карта выдана", failed:"Не удалось записать NFC", code:"Код работника", issued:"Выданный URL (QR можно распечатать)", fallback:"Распечатайте URL как QR-код или запишите его отдельным NFC-устройством.", retry:"Записать снова", next:"Выдать следующую карту", print:"Печать QR", workerFooter:"QR работника: вход сразу без выбора роли. NFC-касание: выберите только гражданство.", adminFooter:"QR администратора: для руководителя объекта/менеджера безопасности. После сканирования открывается выбор роли." },
};

type Site = {
    id: string;
    name: string;
    code?: string | null;
    address?: string | null;
};

type NfcStep = "idle" | "ready" | "writing" | "done" | "error";

export default function QRDistributionPage() {
    const router = useRouter();
    const lang = useDisplayLanguage();
    const t = QR_UI[lang] || QR_UI.en;
    const nfcT = NFC_ISSUE_UI[lang] || NFC_ISSUE_UI.en;
    const nfcFlow = NFC_FLOW_UI[lang] || NFC_FLOW_UI.en;
    const [baseUrl, setBaseUrl] = useState("");
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [sites, setSites] = useState<Site[]>([]);
    const [selectedSiteId, setSelectedSiteId] = useState("");
    const [loadingSites, setLoadingSites] = useState(true);

    // NFC 상태
    const [nfcWorkerName, setNfcWorkerName] = useState("");
    const [nfcNameInitials, setNfcNameInitials] = useState("");
    const [nfcPhoneLast4, setNfcPhoneLast4] = useState("");
    const [nfcStep, setNfcStep] = useState<NfcStep>("idle");
    const [nfcUrl, setNfcUrl] = useState("");
    const [nfcWorkerCode, setNfcWorkerCode] = useState("");
    const [nfcIssuedWorkerId, setNfcIssuedWorkerId] = useState("");
    const [nfcError, setNfcError] = useState("");
    const [nfcLoading, setNfcLoading] = useState(false);

    const nfcSupport = detectNfcSupport();

    useEffect(() => {
        if (typeof window !== "undefined") setBaseUrl(window.location.origin);
    }, []);

    useEffect(() => {
        const loadSites = async () => {
            setLoadingSites(true);
            try {
                const res = await fetch("/api/sites/options", { credentials: "include", cache: "no-store" });
                const data = res.ok ? await res.json() as { sites?: Array<{ id: string; name: string; site_code?: string | null }> } : {};
                const siteRows: Site[] = (data.sites ?? []).map((site) => ({
                    id: site.id,
                    name: site.name,
                    code: site.site_code ?? null,
                    address: null,
                }));
                setSites(siteRows);
                setSelectedSiteId(siteRows[0]?.id || "");
            } catch {
                setSites([]);
                setSelectedSiteId("");
            } finally {
                setLoadingSites(false);
            }
        };
        loadSites();
    }, []);

    const selectedSite = sites.find((s) => s.id === selectedSiteId) || null;

    const buildRoleUrl = (role: "admin" | "worker") => {
        const path = role === "worker" ? "/qr/site" : "/auth";
        const params = new URLSearchParams({ role });
        if (selectedSiteId) params.set("site_id", selectedSiteId);
        return `${baseUrl}${path}?${params.toString()}`;
    };

    const handleDownload = (title: string, canvasId: string) => {
        try {
            const canvas = document.getElementById(canvasId);
            if (!(canvas instanceof HTMLCanvasElement)) throw new Error("qr_canvas_not_found");
            const link = document.createElement("a");
            link.href = canvas.toDataURL("image/png");
            link.download = `${title.replace(/[^a-zA-Z0-9]+/g, "_")}_qr.png`;
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch {
            alert(t.qrDownloadFailed);
        }
    };

    const handleCopyUrl = async (key: string, url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            setCopiedKey(key);
            window.setTimeout(() => setCopiedKey(null), 1500);
        } catch {
            alert(t.urlCopyFailed);
        }
    };

    // NFC 근로자 카드 발급
    const handleNfcIssue = async () => {
        const name = nfcWorkerName.trim();
        if (!name) { setNfcError(nfcT.nameRequired); return; }
        setNfcError("");
        setNfcLoading(true);

        try {
            const cleanInitials = nfcNameInitials.trim();
            const cleanLast4 = nfcPhoneLast4.trim();
            if (!cleanInitials || cleanLast4.length !== 4) {
                setNfcError(nfcT.identityRequired);
                setNfcLoading(false);
                return;
            }

            let workerId = nfcIssuedWorkerId;
            if (!workerId) {
                // 근로자 등록. V3 API는 worker wrapper 없이 WorkerResponse를 바로 반환한다.
                const regRes = await fetch("/api/nfc/workers", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        full_name: name,
                        assigned_site_id: selectedSiteId || undefined,
                        consent_signed_at: new Date().toISOString(),
                        nationality: "KR",
                        trade: "general",
                        preferred_lang: "ko",
                        name_initials: cleanInitials,
                        phone_last4: cleanLast4,
                    }),
                });
                const regData = await regRes.json() as {
                    id?: string;
                    worker_code?: string;
                    worker?: { id?: string; worker_code?: string };
                    error?: string;
                    detail?: string;
                };
                if (!regRes.ok) {
                    setNfcError(`${regData.error || nfcT.registerFailed}${regData.detail ? `: ${regData.detail}` : ""}`);
                    setNfcLoading(false);
                    return;
                }

                workerId = regData.id || regData.worker?.id || "";
                const workerCode = regData.worker_code || regData.worker?.worker_code || "";
                if (!workerId) {
                    setNfcError(nfcT.missingId);
                    setNfcLoading(false);
                    return;
                }
                setNfcIssuedWorkerId(workerId);
                setNfcWorkerCode(workerCode);
            }

            // 스티커 URL 발급
            const issueRes = await fetch("/api/nfc/sticker/issue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ worker_id: workerId, revoke_previous: true }),
            });
            const issueData = await issueRes.json() as { url?: string; error?: string; detail?: string };
            if (!issueRes.ok) { setNfcError(issueData.detail || issueData.error || nfcT.urlFailed); setNfcLoading(false); return; }

            setNfcUrl(issueData.url!);
            setNfcLoading(false);
            setNfcStep(nfcSupport.supported ? "ready" : "done");
        } catch {
            setNfcError(nfcT.urlRetry);
            setNfcStep("error");
            setNfcLoading(false);
        }
    };

    const handleWriteNfc = async () => {
        if (!nfcUrl) return;
        setNfcError("");
        setNfcStep("writing");
        try {
            await writeNfcUrl(nfcUrl);
            setNfcStep("done");
        } catch (err) {
            const nfcErr = err instanceof NfcError ? err : null;
            if (nfcErr?.code === "permission_denied") {
                setNfcError(nfcT.permission);
            } else {
                const detail = nfcErr ? `[${nfcErr.code}] ${nfcErr.message}` : String(err);
                setNfcError(`${nfcT.writeFailed}: ${detail}`);
            }
            setNfcStep("error");
        }
    };

    const resetNfc = () => {
        setNfcStep("idle");
        setNfcWorkerName("");
        setNfcNameInitials("");
        setNfcPhoneLast4("");
        setNfcUrl("");
        setNfcWorkerCode("");
        setNfcIssuedWorkerId("");
        setNfcError("");
        setNfcLoading(false);
    };

    const qrs = [
        {
            key: "admin",
            title: t.adminQr,
            desc: t.adminQrDesc,
            url: buildRoleUrl("admin"),
            color: "blue",
            icon: <Shield className="w-8 h-8" />,
        },
        {
            key: "worker",
            title: t.workerQr,
            desc: t.workerQrDesc,
            url: buildRoleUrl("worker"),
            color: "emerald",
            icon: <Users className="w-8 h-8" />,
        },
    ];

    return (
        <RoleGuard allowedRole="admin">
            <main className="visualization-light min-h-screen p-4 sm:p-6 md:p-12 font-sans">
                <div className="max-w-6xl mx-auto flex flex-col gap-10">

                    {/* Header */}
                    <header className="concept-page-header">
                        <button
                            onClick={() => router.back()}
                            className="w-11 h-11 sm:w-12 sm:h-12 shrink-0 glass rounded-2xl flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-lg active:scale-90"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <span className="text-base font-black tracking-tight text-[#063789]">SQ LINK</span>
                    </header>

                    <div className="admin-concept-hero relative h-44 w-full overflow-hidden rounded-[36px] border border-white/10 shadow-2xl">
                        <picture>
                            <source media="(max-width: 639px)" srcSet="/images/mobile-v3/android/nfc-qr.webp" />
                            <Image src="/images/mobile-v3/website/nfc-qr.webp" alt="QR and NFC access center" fill className="object-cover" priority />
                        </picture>
                        <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-slate-950/15" />
                        <div className="absolute inset-x-0 bottom-0 z-10 p-5 text-white sm:p-8">
                            <p className="text-[10px] font-black tracking-[.18em] text-blue-200">SQ LINK ACCESS</p>
                            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{t.title}</h1>
                            <p className="mt-2 text-sm font-bold text-slate-100">{t.desc}</p>
                        </div>
                    </div>

                    {/* Site Binding */}
                    <section className="glass rounded-[40px] p-8 border-white/10 flex flex-col gap-4">
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tight">{t.siteSettings}</h2>
                            <p className="text-slate-400 font-bold text-sm mt-1">
                                {t.siteDesc}
                            </p>
                        </div>

                        {loadingSites ? (
                            <p className="text-sm font-bold text-slate-500">{t.loadingSites}</p>
                        ) : sites.length > 0 ? (
                            <>
                                <select
                                    value={selectedSiteId}
                                    onChange={(e) => setSelectedSiteId(e.target.value)}
                                    className="w-full bg-slate-900/70 border border-white/10 rounded-2xl px-4 py-4 text-white font-bold focus:outline-none focus:border-blue-500/40"
                                >
                                    {sites.map((site) => (
                                        <option key={site.id} value={site.id}>
                                            {site.code ? `[${site.code}] ` : ""}{site.name}
                                        </option>
                                    ))}
                                </select>
                                {selectedSite && (
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                        <p className="text-[11px] font-black text-blue-400 uppercase tracking-widest">{t.selectedSite}</p>
                                        <p className="mt-1 text-lg font-black text-white">
                                            {selectedSite.code ? `[${selectedSite.code}] ` : ""}{selectedSite.name}
                                        </p>
                                        {selectedSite.address && (
                                            <p className="mt-1 text-sm font-bold text-slate-500">{selectedSite.address}</p>
                                        )}
                                        <p className="mt-2 text-xs font-mono text-slate-600">site_id = {selectedSite.id}</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm font-bold text-amber-300">
                                {t.noSite}
                                <button onClick={() => router.push("/auth/setup")} className="ml-2 underline">{t.profile}</button>
                            </div>
                        )}
                    </section>

                    {/* NFC 근로자 카드 발급 */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="glass rounded-[32px] sm:rounded-[48px] p-5 sm:p-10 border-white/10 hover:border-cyan-500/20 transition-all shadow-2xl relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-500/5 blur-[120px] rounded-full -ml-48 -mt-48 pointer-events-none" />
                        <div className="relative flex flex-col gap-6">
                            <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                                <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 glass rounded-2xl flex items-center justify-center text-cyan-400 shadow-lg">
                                    <Nfc className="w-8 h-8" />
                                </div>
                                <div>
                                    <h2 className="text-xl sm:text-2xl font-black text-white uppercase italic">{nfcT.title}</h2>
                                    <p className="text-slate-400 font-bold text-sm">{nfcT.subtitle}</p>
                                </div>
                            </div>

                            {nfcStep === "idle" && (
                                <div className="flex flex-col gap-4">
                                    <div>
                                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 block">{nfcT.name}</label>
                                        <input
                                            value={nfcWorkerName}
                                            onChange={(e) => setNfcWorkerName(e.target.value)}
                                            placeholder="홍길동"
                                            className="w-full bg-slate-900/70 border border-white/10 rounded-2xl px-4 py-3.5 text-white font-bold focus:outline-none focus:border-cyan-500/40 placeholder-slate-700"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 block">{nfcT.initials}</label>
                                            <input
                                                value={nfcNameInitials}
                                                onChange={(e) => setNfcNameInitials(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase())}
                                                placeholder="HGD"
                                                maxLength={4}
                                                className="w-full bg-slate-900/70 border border-white/10 rounded-2xl px-4 py-3 text-white font-bold font-mono focus:outline-none focus:border-cyan-500/40 placeholder-slate-700"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 block">{nfcT.phone}</label>
                                            <input
                                                value={nfcPhoneLast4}
                                                onChange={(e) => setNfcPhoneLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                                placeholder="1234"
                                                maxLength={4}
                                                inputMode="numeric"
                                                className="w-full bg-slate-900/70 border border-white/10 rounded-2xl px-4 py-3 text-white font-bold font-mono focus:outline-none focus:border-cyan-500/40 placeholder-slate-700"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[11px] font-bold text-slate-600">{nfcFlow.privacy}</p>

                                    <button
                                        onClick={handleNfcIssue}
                                        disabled={nfcLoading || !nfcWorkerName.trim() || !nfcNameInitials.trim() || nfcPhoneLast4.length !== 4}
                                        className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black rounded-2xl transition-all flex items-center justify-center gap-2"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        {nfcLoading ? nfcT.processing : nfcSupport.supported ? nfcT.issueWrite : nfcT.issueUrl}
                                    </button>

                                    {nfcError && (
                                        <p className="text-red-400 text-sm font-bold">{nfcError}</p>
                                    )}
                                    {!nfcSupport.supported && (
                                        <p className="text-yellow-400/70 text-xs font-bold">
                                            {nfcT.unsupported}
                                        </p>
                                    )}
                                </div>
                            )}

                            {nfcStep === "ready" && (
                                <div className="flex flex-col gap-4">
                                    <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-5">
                                        <p className="text-[11px] font-black text-cyan-400 uppercase tracking-widest mb-1">{nfcFlow.ready}</p>
                                        <p className="text-xs font-mono text-slate-400 break-all">{nfcUrl}</p>
                                    </div>
                                    <ol className="flex flex-col gap-1.5 text-sm font-bold text-slate-400 list-none">
                                        <li>{nfcFlow.one}</li>
                                        <li>{nfcFlow.two}</li>
                                        <li>{nfcFlow.three}</li>
                                    </ol>
                                    <p className="text-[11px] font-bold text-amber-400/80">
                                        {nfcFlow.permission}
                                    </p>
                                    <button
                                        onClick={handleWriteNfc}
                                        className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95"
                                    >
                                        <Nfc className="w-5 h-5" />
                                        {nfcFlow.write}
                                    </button>
                                </div>
                            )}

                            {nfcStep === "writing" && (
                                <div className="flex flex-col items-center gap-4 py-6">
                                    <Nfc className="w-16 h-16 text-cyan-400 animate-pulse" />
                                    <p className="text-white font-black text-lg">{nfcFlow.tap}</p>
                                    <p className="text-slate-400 text-sm">{nfcFlow.writing}</p>
                                </div>
                            )}

                            {(nfcStep === "done" || nfcStep === "error") && (
                                <div className="flex flex-col gap-4">
                                    <div className={`rounded-2xl p-5 border ${nfcStep === "done" ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                                        <div className="flex items-center gap-3 mb-3">
                                            {nfcStep === "done"
                                                ? <CheckCircle className="w-6 h-6 text-green-400" />
                                                : <AlertCircle className="w-6 h-6 text-red-400" />}
                                            <div>
                                                <p className="text-white font-black">{nfcStep === "done" ? nfcFlow.done : nfcFlow.failed}</p>
                                                <p className="text-slate-400 text-sm">{nfcFlow.code}: <span className="font-mono text-white">{nfcWorkerCode}</span></p>
                                            </div>
                                        </div>
                                        {nfcUrl && (
                                            <div className="bg-slate-900 rounded-xl p-3 flex flex-col gap-3">
                                                <div className="mx-auto rounded-xl bg-white p-3">
                                                    <QRCodeCanvas
                                                        id="nfc-worker-qr-canvas"
                                                        value={nfcUrl}
                                                        size={220}
                                                        level="M"
                                                        marginSize={1}
                                                    />
                                                </div>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{nfcFlow.issued}</p>
                                                <p className="text-xs font-mono text-cyan-400 break-all">{nfcUrl}</p>
                                            </div>
                                        )}
                                        {nfcStep === "error" && nfcError && (
                                            <p className="text-red-400 text-sm font-bold mt-2">{nfcError}</p>
                                        )}
                                        {nfcStep === "done" && !nfcSupport.supported && (
                                            <p className="text-yellow-400/70 text-xs font-bold mt-2">
                                                {nfcFlow.fallback}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex gap-3">
                                        {nfcStep === "error" && nfcUrl && (
                                            <button onClick={handleWriteNfc} className="flex-1 bg-cyan-700 hover:bg-cyan-600 py-3 rounded-2xl font-black text-white transition-all flex items-center justify-center gap-2">
                                                <Nfc className="w-4 h-4" /> {nfcFlow.retry}
                                            </button>
                                        )}
                                        <button onClick={resetNfc} className="flex-1 bg-cyan-600 hover:bg-cyan-500 py-3 rounded-2xl font-black text-white transition-all">
                                            {nfcFlow.next}
                                        </button>
                                        {nfcUrl && (
                                            <button
                                                onClick={() => handleDownload(`NFC_${nfcWorkerCode}`, "nfc-worker-qr-canvas")}
                                                className="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-2xl font-black text-slate-300 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Download className="w-4 h-4" /> {nfcFlow.print}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.section>

                    {/* QR 배포 */}
                    <div className="flex flex-col gap-4">
                        <h2 className="text-xl font-black text-white uppercase tracking-tight px-2">{t.qrDistribution}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {qrs.map((qr, idx) => (
                                <motion.section
                                    key={qr.key}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 + idx * 0.1 }}
                                    className="glass rounded-[48px] p-10 border-white/10 relative overflow-hidden flex flex-col gap-8 group"
                                >
                                    <div className={`absolute top-0 right-0 w-64 h-64 bg-${qr.color}-500/10 blur-[100px] rounded-full -mr-32 -mt-32 pointer-events-none group-hover:bg-${qr.color}-500/20 transition-all duration-1000`} />

                                    <div className="flex items-start justify-between relative">
                                        <div className="flex flex-col gap-3">
                                            <div className={`w-16 h-16 glass rounded-2xl flex items-center justify-center text-${qr.color}-400 mb-2 shadow-lg`}>
                                                {qr.icon}
                                            </div>
                                            <h3 className="text-2xl font-black text-white italic">{qr.title}</h3>
                                            <p className="text-slate-400 font-bold leading-relaxed max-w-sm text-sm">{qr.desc}</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center gap-6 bg-white/5 p-8 rounded-[40px] border border-white/5 group-hover:bg-white/10 transition-colors">
                                        <div className="bg-white p-5 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                                            <QRCodeCanvas
                                                id={`site-${qr.key}-qr-canvas`}
                                                value={qr.url}
                                                size={240}
                                                level="M"
                                                marginSize={1}
                                            />
                                        </div>
                                        <p className="text-xs font-mono text-blue-400 opacity-60 break-all text-center px-2">{qr.url}</p>
                                    </div>

                                    <div className="flex gap-4 mt-auto">
                                        <button
                                            onClick={() => handleDownload(qr.title, `site-${qr.key}-qr-canvas`)}
                                            className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
                                        >
                                            <Download className="w-5 h-5" /> {t.download}
                                        </button>
                                        <button
                                            onClick={() => handleCopyUrl(qr.key, qr.url)}
                                            className="w-14 py-4 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl flex items-center justify-center transition-all active:scale-95"
                                        >
                                            <QrCode className="w-5 h-5" />
                                        </button>
                                    </div>
                                    {copiedKey === qr.key && (
                                        <p className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">{t.copied}</p>
                                    )}
                                </motion.section>
                            ))}
                        </div>
                    </div>

                    <footer className="glass rounded-[40px] p-6 border-dashed border-white/10 text-center">
                        <p className="text-slate-500 font-bold text-sm">
                            * {nfcFlow.workerFooter}<br />
                            * {nfcFlow.adminFooter}
                        </p>
                    </footer>
                </div>
            </main>
        </RoleGuard>
    );
}
