/* i18n runtime for Lurek personal site.
 *
 * The bundled jquery.i18n plugin only reads the `i18n` attribute and flat
 * JSON, so we do NOT use it for [data-i18n]. Instead this file implements a
 * small, explicit nested-JSON renderer:
 *
 *   lookupKey(data, "home.title")   -> nested path lookup
 *   loadLanguage(lang)              -> loads i18n_<lang>.json, renders text,
 *                                      html fields, alt/aria-label/title
 *                                      attributes, syncs <html lang> and
 *                                      localStorage, and triggers the Home
 *                                      animation exactly once per language
 *                                      content landing.
 */

function updateDocumentLanguage(lang) {
  document.documentElement.lang = lang === "cn" ? "zh-CN" : "en";
}

function lookupKey(data, dottedKey) {
  return dottedKey.split(".").reduce(function (acc, part) {
    return acc && acc[part] !== undefined ? acc[part] : undefined;
  }, data);
}

function renderTextI18n(data) {
  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    var key = el.getAttribute("data-i18n");
    if (!key) return;
    var v = lookupKey(data, key);
    if (typeof v === "string") el.textContent = v;
  });
}

// Only for trusted local fields that legitimately contain markup (e.g.
// contact.email_address with a <br>).
function renderHtmlI18n(data) {
  document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
    var key = el.getAttribute("data-i18n-html");
    if (!key) return;
    var v = lookupKey(data, key);
    if (typeof v === "string") el.innerHTML = v;
  });
}

function renderAttrI18n(data) {
  document.querySelectorAll("[data-i18n-alt], [data-i18n-aria-label], [data-i18n-title]").forEach(function (el) {
    ["alt", "aria-label", "title"].forEach(function (attr) {
      var key = el.getAttribute("data-i18n-" + attr);
      if (!key) return;
      var v = lookupKey(data, key);
      if (typeof v === "string") el.setAttribute(attr, v);
    });
  });
}

function updateTranslateLabel(lang) {
  var label = lang === "cn" ? "中/En" : "En/中";
  var el = document.getElementById("nav__translate");
  if (el) el.textContent = label;
}

// Guard against out-of-order async responses when the user switches
// language rapidly: a stale response is ignored.
var loadToken = 0;

// The language we are aiming at. Kept as a separate variable so rapid
// clicks do not depend on the not-yet-updated localStorage value.
var desiredLanguage = "en";

function loadLanguage(lang) {
  var token = ++loadToken;
  return $.getJSON("assets/i18n/i18n_" + lang + ".json")
    .done(function (data) {
      if (token !== loadToken) return; // stale response
      renderTextI18n(data);
      renderHtmlI18n(data);
      renderAttrI18n(data);
      updateDocumentLanguage(lang);
      localStorage.setItem("lang", lang);
      updateTranslateLabel(lang);
      window.__i18nReady = true;
      if (window.markAppReady) window.markAppReady();
      // Single trigger: the Home sequence starts only after the target
      // language text has fully landed in the DOM.
      if (window.__lurek && window.__lurek.refreshHome) {
        window.__lurek.refreshHome();
      }
    })
    .fail(function () {
      if (token !== loadToken) return;
      console.error("[i18n] failed to load language file: assets/i18n/i18n_" + lang + ".json");
      // Do NOT set __i18nReady: the 5s watchdog will remove .js-enabled
      // and the Chinese HTML fallback remains readable.
    });
}

// Single language toggle shared by the desktop menu button (#translate)
// and the mobile top bar button (#mobile-translate). It flips the
// desired target language immediately (not based on localStorage, which
// may not have been updated yet during rapid clicks) and delegates to
// loadLanguage, which keeps its own loadToken ordering guard.
function toggleLanguage() {
  desiredLanguage = desiredLanguage === "cn" ? "en" : "cn";
  loadLanguage(desiredLanguage);
}

$(document).ready(function () {
  var stored = localStorage.getItem("lang");
  var defaultLang = stored ? stored : "en";
  desiredLanguage = defaultLang;
  updateDocumentLanguage(defaultLang);
  updateTranslateLabel(defaultLang);
  loadLanguage(defaultLang);

  // Both language buttons call the same toggleLanguage(); neither button
  // simulates a click on the other.
  $("#translate").on("click", toggleLanguage);
  $("#mobile-translate").on("click", toggleLanguage);
});
