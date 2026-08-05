$(document).ready(function () {
    /*默认语言*/
    const lang = localStorage.getItem("lang");
    const defaultLang = lang ? lang : "en";
    $("[i18n]").i18n({
        defaultLang: defaultLang,
        filePath: "assets/i18n/",
        filePrefix: "i18n_",
        fileSuffix: "",
        forever: true,
        callback: function () {
            console.log("i18n is ready.");
            // 强制用html渲染about__description和手动渲染qualification所有字段
            const aboutDesc = $("[i18n='about__description']");
            const lang = localStorage.getItem("lang") || defaultLang;
            $.getJSON(`assets/i18n/i18n_${lang}.json`, function (data) {
                aboutDesc.html(data['about__description']);
                [
                    "qualification1__title", "qualification1__subtitle", "qualification1__date",
                    "qualification2__title", "qualification2__subtitle", "qualification2__date",
                    "qualification3__title", "qualification3__subtitle", "qualification3__date",
                    "qualification9__title", "qualification9__subtitle", "qualification9__date",
                    "cert1__title", "cert1__subtitle", "cert1__date",
                    "cert2__title", "cert2__subtitle", "cert2__date",
                    "cert3__title", "cert3__subtitle", "cert3__date"
                ].forEach(function (key) {
                    $("[i18n='" + key + "']").text(data[key]);
                });
            });
        },
    });

    /*中英文切换按钮*/
    const text = defaultLang == "cn" ? "中/En" : "En/中";
    $("#nav__translate").text(text);
    $("#translate").click(function (e) {
        const currentLang = localStorage.getItem("lang") ? localStorage.getItem("lang") : defaultLang;
        const targetLang = currentLang == "cn" ? "en" : "cn";
        const text = targetLang == "cn" ? "中/En" : "En/中";
        $("#nav__translate").text(text);

        $("[i18n]").i18n({
            defaultLang: targetLang,
            filePath: "assets/i18n/",
            callback: function () {
                localStorage.setItem("lang", targetLang);
                console.log(localStorage.getItem("lang"));
                // 强制用html渲染about__description和手动渲染qualification所有字段
                const aboutDesc = $("[i18n='about__description']");
                $.getJSON(`assets/i18n/i18n_${targetLang}.json`, function (data) {
                    aboutDesc.html(data['about__description']);
                    [
                        "qualification1__title", "qualification1__subtitle", "qualification1__date",
                        "qualification2__title", "qualification2__subtitle", "qualification2__date",
                        "qualification3__title", "qualification3__subtitle", "qualification3__date",
                        "qualification9__title", "qualification9__subtitle", "qualification9__date",
                        "cert1__title", "cert1__subtitle", "cert1__date",
                        "cert2__title", "cert2__subtitle", "cert2__date",
                        "cert3__title", "cert3__subtitle", "cert3__date"
                    ].forEach(function (key) {
                        $("[i18n='" + key + "']").text(data[key]);
                    });
                });
            }
        });
    });
});
