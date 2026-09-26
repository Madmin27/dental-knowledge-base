import { renderMembership } from "./membership.js";
const tr = {
  skip: "İçeriğe geç",
  languageLabel: "Dil",
  retention:
    "Pilot saklama süresi: tamamlanan paketler en fazla 30 gün; tamamlanmayan paketler en fazla 24 saat. Daha erken silme isteyebilirsiniz. Şifreli yedekler bu sunucuda en fazla 14 günlük kopya tutar.",
  atlas: "3B atlas",
  guide: "Çekim rehberi",
  eyebrow: "KATKI · ÖZEL ÇALIŞMA ALANI",
  title: "Gözlemleriniz. Özenli bir inceleme.",
  intro:
    "Tek bir diş örneğinin fotoğraflarıyla katkıda bulunun. Yetkili bir kişi gizlilik ve izinleri incelerken dosyalarınız özel alanda kalır.",
  step1: "1 · Doğrulanmış hesap",
  step2: "2 · Özel fotoğraflar",
  step3: "3 · İnsan gizlilik incelemesi",
  invite: "Katkıcı ve denetleyici paneli",
  inviteText:
    "Kişisel hesabınız ve doğrulayıcı kodunuzla giriş yapın. Hesap sahibi olmak inceleme yetkisi vermez.",
  login: "Güvenli giriş",
  accountHelp:
    "E-posta doğrulaması ve iki aşamalı girişten sonra görev başvurusu yapabilirsiniz. Yetkiler ayrıca değerlendirilir.",
  workspace: "Katkı çalışma alanı",
  reauth: "Kimliğini yeniden doğrula",
  logout: "Çıkış",
  packages: "Fotoğraf paketleri",
  scope:
    "Kendi paketleriniz ve yetkiliyseniz fotoğraf pilotunun gizlilik kuyruğu.",
  new: "Yeni paket",
  select: "Bir paket seçin veya yeni katkı hazırlayın.",
  english:
    "Katkınızı İngilizce yazın. Hasta adı, kayıt numarası veya doğum tarihi eklemeyin.",
  purpose: "Katkının amacı (İngilizce)",
  authority: "Yetki / izin referansı (İngilizce, hasta kimliği olmadan)",
  fdi: "Biliniyorsa FDI diş numarası",
  same: "Bu paketteki tüm fotoğraflar aynı örneğe aittir.",
  noPatient:
    "Hasta kimlik bilgilerini kaldırdım; röntgen veya yüz fotoğrafı göndermiyorum.",
  inspectConsent:
    "Özel saklama ve yetkili fotoğraf pilotu gizlilik ekibinin incelemesine izin veriyorum.",
  processingConsent:
    "Özel inceleme kopyası için yerel güvenlik taraması ve metadata temizliğine izin veriyorum.",
  noOtherConsent:
    "AI çıkarımı, AI eğitimi, özgün fotoğraf ve türev yayın izinleri verilmez. Bu izinler kapalı kalır.",
  create: "Özel paket oluştur",
  privateTitle: "Varsayılan olarak özel",
  privateText:
    "Şifreli dosyalar, kapsamlı yetki ve kayıtlı karar. Herkese açık görüntü bağlantısı yok.",
  humanTitle: "İnsan kararı",
  humanText:
    "Katılımcı kendi fotoğraflarını onaylayamaz. Gizlilik uygunluğu anatomik kabul değildir.",
  limitsTitle: "Önce fotoğraflar",
  limitsText:
    "JPEG / PNG · Dosya başına 20 MiB · 40 megapiksel. Röntgen, DICOM, arşiv ve AI rekonstrüksiyonu bu alanda açık değil.",
};
let savedLanguage = "en";
try {
  savedLanguage = localStorage.getItem("dental-language") ?? "en";
} catch {}
const cookieLanguage = document.cookie
  .split(";")
  .map((x) => x.trim())
  .find((x) => /^dental-language=(en|tr)$/.test(x))
  ?.split("=")[1];
let lang =
  new URL(location.href).searchParams.get("lang") ??
  cookieLanguage ??
  savedLanguage ??
  "en";
if (!["en", "tr"].includes(lang)) lang = "en";
const t = (en, turkish) => (lang === "tr" ? turkish : en);
document.documentElement.lang = lang;
document.cookie = `dental-language=${lang}; Path=/; SameSite=Lax; Max-Age=31536000; Secure`;
document.querySelector("#language").value = lang;
for (const e of document.querySelectorAll("[data-i18n]"))
  if (lang === "tr") e.textContent = tr[e.dataset.i18n] ?? e.textContent;
document.querySelector("#language").addEventListener("change", (e) => {
  const u = new URL(location.href);
  u.searchParams.set("lang", e.target.value);
  try {
    localStorage.setItem("dental-language", e.target.value);
  } catch {}
  location.href = u;
});
const $ = (s) => document.querySelector(s),
  node = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
let session,
  current,
  busy = false;
function failure(error) {
  const codes = {
    service_busy: t(
      "The workspace is busy. Try again shortly.",
      "Çalışma alanı meşgul. Biraz sonra yeniden deneyin.",
    ),
    processing_busy: t(
      "Processing is busy or an interrupted job is expiring. Retry in two minutes.",
      "İşleyici meşgul veya yarım kalan işlemin süresi doluyor. İki dakika sonra yeniden deneyin.",
    ),
    csrf_failed: t(
      "Session check failed. Reload and sign in again.",
      "Oturum kontrolü başarısız. Yenileyip tekrar giriş yapın.",
    ),
    reauthenticate: t(
      "Verify your identity again before reviewing.",
      "İnceleme için kimliğinizi yeniden doğrulayın.",
    ),
    stale_revision: t(
      "This photo changed. Reload the package before deciding.",
      "Fotoğraf değişti. Karardan önce paketi yeniden açın.",
    ),
    processing_unavailable: t(
      "Processing did not complete. The photo remains quarantined; retry later.",
      "İşleme tamamlanmadı. Fotoğraf karantinada kaldı; daha sonra yeniden deneyin.",
    ),
    pilot_not_open: t(
      "Photo intake is waiting for the named pilot team.",
      "Fotoğraf kabulü, pilot ekibin atanmasını bekliyor.",
    ),
  };
  $("#error").textContent =
    codes[error.message] ??
    t("The action could not be completed: ", "İşlem tamamlanamadı: ") +
      error.message;
  $("#error").hidden = false;
}
async function api(path, options = {}) {
  const headers = {
    ...(options.body instanceof Blob
      ? { "Content-Type": "application/octet-stream" }
      : options.body
        ? { "Content-Type": "application/json" }
        : {}),
    ...(session?.csrf ? { "X-CSRF-Token": session.csrf } : {}),
  };
  const r = await fetch("/review/api/" + path, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  let data;
  try {
    data = await r.json();
  } catch {
    throw new Error("service_unavailable");
  }
  if (!r.ok) throw new Error(data.error ?? "service_unavailable");
  return data;
}
async function refresh() {
  session = await api("session");
  $("#signed-out").hidden = session.authenticated;
  $("#workspace").hidden = !session.authenticated;
  $("#notice").textContent = session.uploadsEnabled
    ? t(
        "Private photo pilot · No public release or AI generation.",
        "Özel fotoğraf pilotu · Yayın ve AI üretimi yok.",
      )
    : t(
        "Workspace ready. Photo intake is closed until the invited team is provisioned and acceptance checks are complete.",
        "Çalışma alanı hazır. Davetli ekip atanıp kabul kontrolleri tamamlanana kadar fotoğraf kabulü kapalı.",
      );
  const registration = document.querySelector("#registration");
  registration.hidden = session.authenticated || !session.registrationEnabled;
  if (!session.authenticated && !session.registrationEnabled)
    document.querySelector('[data-i18n="accountHelp"]').textContent = t(
      "Self-registration is awaiting email delivery setup. Existing invited accounts can sign in.",
      "Kendi hesabınızı oluşturma, e-posta gönderim kurulumunu bekliyor. Mevcut davetli hesaplar giriş yapabilir.",
    );
  if (!session.authenticated) return;
  await renderMembership({ session, api, node, t, refresh, failure });
  $("#new-package").hidden =
    !session.grants.includes("photo_contributor") || !session.uploadsEnabled;
  const list = $("#package-list");
  list.replaceChildren();
  for (const p of session.packages) {
    const b = node(
      "button",
      (p.owned ? t("Mine · ", "Benim · ") : t("Review · ", "İnceleme · ")) +
        p.metadata.purpose.slice(0, 90),
      "package",
    );
    b.addEventListener("click", () => detail(p.id).catch(failure));
    list.append(b);
  }
  if (!session.packages.length)
    list.append(node("p", t("No packages yet.", "Henüz paket yok."), "muted"));
}
$("#logout").addEventListener("click", async () => {
  try {
    await api("logout", { method: "POST" });
    location.reload();
  } catch (e) {
    failure(e);
  }
});
$("#new-package").addEventListener("click", () => {
  $("#new-panel").hidden = false;
  $("#new-panel").scrollIntoView({ behavior: "smooth" });
  $("#package-form textarea").focus();
});
$("#package-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy) return;
  busy = true;
  const button = e.target.querySelector("button");
  button.disabled = true;
  try {
    const f = new FormData(e.target);
    const p = await api("packages", {
      method: "POST",
      body: JSON.stringify({
        id: crypto.randomUUID(),
        modality: "photo",
        purpose: f.get("purpose"),
        authorityReference: f.get("authorityReference"),
        fdi: f.get("fdi"),
        sameSpecimen: f.has("sameSpecimen"),
        noPatientIdentifiers: f.has("noPatientIdentifiers"),
        consent: {
          privateInspection: f.has("privateInspection"),
          processing: f.has("processing"),
          inference: false,
          derivativePublication: false,
          rawPublication: false,
          training: false,
        },
      }),
    });
    e.target.reset();
    $("#new-panel").hidden = true;
    await refresh();
    await detail(p.id);
  } catch (err) {
    failure(err);
  } finally {
    button.disabled = false;
    busy = false;
  }
});
const states = {
  uploading: ["Uploading", "Yükleniyor"],
  processing: ["Security processing", "Güvenlik işlemi"],
  blocked: [
    "Quarantined · retry needed",
    "Karantinada · yeniden deneme gerekli",
  ],
  privacy_review: ["Awaiting privacy review", "Gizlilik incelemesi bekliyor"],
  privacy_cleared: [
    "Cleared for private inspection only",
    "Yalnız özel inceleme için uygun",
  ],
  needs_information: ["More information needed", "Ek bilgi gerekli"],
  rejected: ["Not cleared", "Uygun bulunmadı"],
};
async function upload(packageId, files, status, existing) {
  for (const file of files) {
    if (
      !["image/jpeg", "image/png"].includes(file.type) ||
      file.size > 20 * 1024 ** 2
    )
      throw new Error("JPEG/PNG · 20 MiB");
    const photoId = existing?.id ?? crypto.randomUUID();
    const reservation = await api(`packages/${packageId}/photos`, {
      method: "POST",
      body: JSON.stringify({
        id: photoId,
        size: file.size,
        type: file.type,
        view: existing?.view_name ?? $("#capture-view")?.value ?? "unknown",
      }),
    });
    if (reservation.state === "uploading") {
      for (let i = 0; i < Math.ceil(file.size / 1048576); i++) {
        status.textContent =
          t("Uploading · ", "Yükleniyor · ") +
          Math.round(((i * 1048576) / file.size) * 100) +
          "%";
        await api(`photos/${photoId}/chunks/${i}`, {
          method: "PUT",
          body: file.slice(i * 1048576, Math.min(file.size, (i + 1) * 1048576)),
        });
      }
    }
    status.textContent = t(
      "Checking the photo securely…",
      "Fotoğraf güvenle kontrol ediliyor…",
    );
    await api(`photos/${photoId}/finalize`, { method: "POST" });
  }
  await detail(packageId);
}
async function detail(packageId) {
  current = await api("packages/" + packageId);
  $("#error").hidden = true;
  const panel = $("#detail");
  panel.replaceChildren(
    node("h2", t("Private photo package", "Özel fotoğraf paketi")),
    node("p", current.metadata.purpose),
    node("p", t("FDI: ", "FDI: ") + current.metadata.fdi, "muted"),
    node(
      "p",
      t("Permission reference: ", "İzin referansı: ") +
        current.metadata.authorityReference,
      "muted",
    ),
  );
  if (
    current.owned &&
    session.uploadsEnabled &&
    session.grants.includes("photo_contributor")
  ) {
    const viewLabel = node(
        "label",
        t(
          "Capture view (choose unknown for mixed views)",
          "Çekim yönü (karışık yönlerde bilinmiyor seçin)",
        ),
      ),
      view = document.createElement("select");
    view.id = "capture-view";
    for (const [key, en, turkish] of [
      ["unknown", "Unknown / mixed", "Bilinmiyor / karışık"],
      ["front", "Front", "Ön"],
      ["back", "Back", "Arka"],
      ["left", "Left", "Sol"],
      ["right", "Right", "Sağ"],
      ["occlusal", "Occlusal", "Çiğneme yüzeyi"],
      ["root_apex", "Root apex", "Kök ucu"],
      ["oblique", "Oblique", "Eğik"],
    ]) {
      const o = node("option", t(en, turkish));
      o.value = key;
      view.append(o);
    }
    viewLabel.append(view);
    panel.append(viewLabel);
    const label = node(
      "label",
      t("Add photographs (JPEG / PNG)", "Fotoğraf ekle (JPEG / PNG)"),
    );
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png";
    input.multiple = true;
    label.append(input);
    const status = node("p", "", "notice");
    status.setAttribute("role", "status");
    input.addEventListener("change", async () => {
      if (!input.files.length) return;
      input.disabled = true;
      try {
        await upload(packageId, [...input.files], status);
      } catch (e) {
        failure(e);
      } finally {
        input.disabled = false;
      }
    });
    panel.append(label, status);
  }
  for (const f of current.files) {
    const section = node("article", null, "photo");
    const names = states[f.state] ?? [f.state, f.state];
    section.append(
      node("span", t(...names), "badge"),
      node(
        "p",
        t("Photo ", "Fotoğraf ") +
          f.id.slice(0, 8) +
          " · " +
          Math.ceil(f.size / 1024) +
          " KiB",
        "muted",
      ),
    );
    if (
      [
        "privacy_review",
        "privacy_cleared",
        "needs_information",
        "rejected",
      ].includes(f.state)
    ) {
      const img = document.createElement("img");
      img.src = `/review/api/photos/${f.id}/preview`;
      img.alt = t(
        "Private specimen photograph for privacy inspection",
        "Gizlilik incelemesi için özel örnek fotoğrafı",
      );
      img.loading = "lazy";
      section.append(img);
      const full = node(
        "a",
        t("Open full-size review copy", "Tam boy inceleme kopyasını aç"),
      );
      full.href = img.src;
      full.target = "_blank";
      full.rel = "noopener noreferrer";
      section.append(full);
      if (!current.owned && session.grants.includes("privacy_reviewer"))
        section.append(decisionForm(f, packageId));
    }
    if (
      current.owned &&
      ["uploading", "blocked", "processing"].includes(f.state)
    ) {
      const label = node(
        "label",
        t(
          "Choose the same file to resume / retry",
          "Devam etmek için aynı dosyayı seçin",
        ),
      );
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/jpeg,image/png";
      const status = node("p", "", "notice");
      input.addEventListener("change", async () => {
        if (!input.files.length) return;
        input.disabled = true;
        try {
          await upload(packageId, [input.files[0]], status, f);
        } catch (e) {
          failure(e);
        } finally {
          input.disabled = false;
        }
      });
      label.append(input);
      section.append(label, status);
    }
    for (const d of current.decisions.filter((d) => d.photo_id === f.id)) {
      const history = node("div", null, "history");
      history.append(
        node(
          "strong",
          new Date(d.created_at).toLocaleString(lang) +
            " · " +
            t(...states[d.decision.decision]),
        ),
        node("p", d.decision.reason),
      );
      section.append(history);
    }
    panel.append(section);
  }
  if (!current.files.length)
    panel.append(
      node(
        "p",
        t("No photographs uploaded.", "Henüz fotoğraf yüklenmedi."),
        "muted",
      ),
    );
  if (current.owned) {
    const erase = node(
      "button",
      t("Delete this private package", "Bu özel paketi sil"),
      "danger",
    );
    erase.addEventListener("click", async () => {
      if (
        !confirm(
          t(
            "Delete all files and private text? Access stops immediately. Encrypted backup copies expire under the retention policy.",
            "Tüm dosyalar ve özel metinler silinsin mi? Erişim hemen durur. Şifreli yedek kopyaları saklama politikasına göre sona erer.",
          ),
        )
      )
        return;
      try {
        await api("packages/" + packageId, { method: "DELETE" });
        panel.replaceChildren(
          node(
            "p",
            t(
              "Access removed and stored package files deleted. Temporary processing expires within 60 seconds; encrypted backups follow retention.",
              "Erişim kaldırıldı ve paket dosyaları silindi. Geçici işlem en geç 60 saniyede sona erer; şifreli yedekler saklama süresine tabidir.",
            ),
          ),
        );
        await refresh();
      } catch (e) {
        failure(e);
      }
    });
    panel.append(erase);
  }
}
function decisionForm(f, packageId) {
  const form = node("form");
  form.append(
    node(
      "h3",
      t("Privacy decision · revision ", "Gizlilik kararı · sürüm ") +
        f.revision,
    ),
  );
  for (const [key, en, turkish] of [
    [
      "pixels",
      "I checked the complete image for identifying pixel content.",
      "Görüntünün tamamını kimlik belirten içerik için kontrol ettim.",
    ],
    [
      "metadata",
      "The review copy contains no identifying metadata.",
      "İnceleme kopyasında kimlik belirten metadata yok.",
    ],
    [
      "authority",
      "The stated authority is sufficient for this private purpose.",
      "Belirtilen yetki bu özel amaç için yeterli.",
    ],
    [
      "scope",
      "This decision is limited to private inspection; it does not permit publication.",
      "Karar yalnız özel inceleme içindir; yayın izni vermez.",
    ],
  ]) {
    const label = node("label", null, "check"),
      check = document.createElement("input");
    check.type = "checkbox";
    check.name = key;
    label.append(check, node("span", t(en, turkish)));
    form.append(label);
  }
  const risks = node("fieldset");
  risks.append(
    node("legend", t("Context / privacy risks", "Bağlam / gizlilik riskleri")),
  );
  for (const [key, en, turkish] of [
    ["specimen_only", "Specimen only", "Yalnız örnek"],
    [
      "linked_research",
      "Linked research specimen",
      "Araştırmayla bağlantılı örnek",
    ],
    ["clinical_context", "Clinical context", "Klinik bağlam"],
    ["identifiable", "Potentially identifiable", "Kimlik belirlenebilir"],
  ]) {
    const label = node("label", null, "check"),
      check = document.createElement("input");
    check.type = "checkbox";
    check.name = "riskTags";
    check.value = key;
    label.append(check, node("span", t(en, turkish)));
    risks.append(label);
  }
  form.append(risks);
  const reasonLabel = node(
      "label",
      t("Reason and scope (English)", "Gerekçe ve kapsam (İngilizce)"),
    ),
    reason = document.createElement("textarea");
  reason.name = "reason";
  reason.required = true;
  reason.minLength = 3;
  reason.maxLength = 2000;
  reasonLabel.append(reason);
  form.append(reasonLabel);
  const label = node("label", t("Decision", "Karar")),
    select = document.createElement("select");
  select.name = "decision";
  for (const key of ["needs_information", "rejected", "privacy_cleared"]) {
    const o = node("option", t(...states[key]));
    o.value = key;
    select.append(o);
  }
  label.append(select);
  form.append(
    label,
    node("button", t("Record privacy decision", "Gizlilik kararını kaydet")),
  );
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      const data = new FormData(form);
      await api(`photos/${f.id}/decision`, {
        method: "POST",
        body: JSON.stringify({
          revision: f.revision,
          decision: data.get("decision"),
          reason: data.get("reason"),
          riskTags: data.getAll("riskTags"),
          checks: Object.fromEntries(
            ["pixels", "metadata", "authority", "scope"].map((k) => [
              k,
              data.has(k),
            ]),
          ),
        }),
      });
      await detail(packageId);
    } catch (err) {
      failure(err);
    } finally {
      button.disabled = false;
    }
  });
  return form;
}
refresh()
  .then(() => {
    if (new URL(location.href).searchParams.get("signin") === "retry")
      failure(
        new Error(
          t(
            "Sign-in was not completed. Finish account verification and authenticator setup, then sign in again. If this continues, ask the project administrator to check your invitation.",
            "Giriş tamamlanmadı. Hesap doğrulamasını ve doğrulayıcı kurulumunu bitirip yeniden giriş yapın. Devam ederse proje yöneticisine davetinizi kontrol ettirin.",
          ),
        ),
      );
  })
  .catch(failure);
