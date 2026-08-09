// 同步 <html lang> 与当前语言：中文 -> zh-CN，英文 -> en
function updateDocumentLanguage(lang) {
    document.documentElement.lang = lang === 'cn' ? 'zh-CN' : 'en';
}

$(document).ready(function () {
    const qualificationKeys = [
        "qualification1__title", "qualification1__subtitle", "qualification1__date",
        "qualification2__title", "qualification2__subtitle", "qualification2__date",
        "qualification3__title", "qualification3__subtitle", "qualification3__date",
        "qualification9__title", "qualification9__subtitle", "qualification9__date",
        "cert1__title", "cert1__subtitle", "cert1__date",
        "cert2__title", "cert2__subtitle", "cert2__date",
        "cert3__title", "cert3__subtitle", "cert3__date"
    ];
    let latestLanguageRequest = 0;
    let lastRenderedLanguage = "cn";

    function normalizeLanguage(lang) {
        return lang === "cn" ? "cn" : "en";
    }

    function updateTranslateLabel(lang) {
        $("#nav__translate").text(lang === "cn" ? "中/En" : "En/中");
    }

    function renderTranslations(data) {
        $("[i18n]").each(function () {
            const $element = $(this);
            const key = $element.attr("i18n");
            const value = data[key];
            const i18nOnly = $element.attr("i18n-only");

            if (typeof value === "undefined") return;

            if ($element.val() != null && $element.val() !== "" &&
                (i18nOnly == null || i18nOnly === "" || i18nOnly === "value")) {
                $element.val(value);
            }
            if ($element.html() != null && $element.html() !== "" &&
                (i18nOnly == null || i18nOnly === "" || i18nOnly === "html")) {
                $element.html(value);
            }
            if ($element.attr("placeholder") != null && $element.attr("placeholder") !== "" &&
                (i18nOnly == null || i18nOnly === "" || i18nOnly === "placeholder")) {
                $element.attr("placeholder", value);
            }
        });
    }

    function renderQualifications(data) {
        qualificationKeys.forEach(function (key) {
            $("[i18n='" + key + "']").text(data[key]);
        });
    }

    function notifyLanguageRendered(lang) {
        document.dispatchEvent(new CustomEvent("app:languagechange", {
            detail: { lang: lang }
        }));
    }

    function applyLanguage(targetLang) {
        const requestId = ++latestLanguageRequest;

        // Commit the sole language state before any asynchronous rendering begins.
        localStorage.setItem("lang", targetLang);
        updateDocumentLanguage(targetLang);
        updateTranslateLabel(targetLang);

        $.getJSON(`assets/i18n/i18n_${targetLang}.json`)
            .done(function (data) {
                if (requestId !== latestLanguageRequest) return;

                renderTranslations(data);
                renderQualifications(data);
                lastRenderedLanguage = targetLang;
                notifyLanguageRendered(targetLang);
            })
            .fail(function () {
                if (requestId !== latestLanguageRequest) return;

                localStorage.setItem("lang", lastRenderedLanguage);
                updateDocumentLanguage(lastRenderedLanguage);
                updateTranslateLabel(lastRenderedLanguage);
                console.error("Unable to load language data for " + targetLang);
            });
    }

    function switchLanguage() {
        const currentLang = normalizeLanguage(localStorage.getItem("lang"));
        applyLanguage(currentLang === "cn" ? "en" : "cn");
    }

    applyLanguage(normalizeLanguage(localStorage.getItem("lang")));

    $("#translate, #mobile-translate").on("click", function (e) {
        e.preventDefault();
        switchLanguage();
    });
});
