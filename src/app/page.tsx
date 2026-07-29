import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#e8f1f2" }}>
      {/* ============ NAV ============ */}
      <nav className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-5 py-3.5 flex items-center gap-4">
          <div className="flex items-center gap-2.5 font-bold text-lg tracking-tight">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs"
              style={{
                background: "linear-gradient(140deg, #1b98e0, #006494)",
                boxShadow: "0 2px 8px rgba(0,100,148,0.3)",
              }}
            >
              ◉
            </div>
            <span style={{ color: "#006494" }}>Ко Манда</span>
          </div>
          <div className="flex-1" />
          <Link
            href="/login"
            className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 bg-white hover:bg-gray-50 transition"
          >
            Вход
          </Link>
          <Link
            href="#contact"
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
            style={{
              background: "linear-gradient(140deg, #1b98e0, #006494)",
              boxShadow: "0 2px 8px rgba(0,100,148,0.2)",
            }}
          >
            Регистрация
          </Link>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <section className="relative pt-16 pb-14 overflow-hidden">
        <div
          className="absolute top-[-280px] left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full pointer-events-none opacity-60"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(27,152,224,0.18), rgba(27,152,224,0.05) 45%, transparent 68%)",
          }}
        />
        <div className="relative max-w-4xl mx-auto px-5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-100 text-sm font-semibold mb-6 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span style={{ color: "#006494" }}>Активен обход — Драгалевци, 10:34</span>
          </div>

          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-none"
            style={{ color: "#006494" }}
          >
            Имотът ти стои празен.
            <br />
            <span
              style={{
                background: "linear-gradient(120deg, #1b98e0, #006494)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Не и без надзор.
            </span>
          </h1>

          <p className="text-lg mt-5 max-w-2xl leading-relaxed" style={{ color: "#247ba0" }}>
            Стопанисване на вакантни имоти — редовни обходи, проветряване, проверка за
            течове и влага, зимна консервация и организиране на ремонти. Всеки обход със
            снимки, час и потвърдена локация.
          </p>

          <div className="flex gap-3 mt-7 flex-wrap">
            <Link
              href="#contact"
              className="px-6 py-3.5 rounded-2xl font-semibold text-base text-white transition hover:translate-y-[-2px]"
              style={{
                background: "linear-gradient(140deg, #1b98e0, #006494)",
                boxShadow: "0 6px 20px rgba(0,100,148,0.3)",
              }}
            >
              Изпрати запитване →
            </Link>
            <Link
              href="/login"
              className="px-6 py-3.5 rounded-2xl font-semibold text-base bg-white border border-gray-200 hover:border-gray-300 transition"
              style={{ color: "#006494" }}
            >
              Виж приложението
            </Link>
          </div>

          <p className="text-sm mt-5" style={{ color: "#247ba0" }}>
            Ядрото ни е грижата за празния имот. Ако ти трябва и пълноценно управление —
            отдаване, наематели, счетоводство — говорим и за това.
          </p>

          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-200 rounded-2xl overflow-hidden mt-10 border border-gray-200">
            {[
              ["2×", "обхода месечно"],
              ["100%", "обходи със снимки"],
              ["±75 м", "GPS локация"],
              ["24 ч", "до оферта"],
            ].map(([num, label]) => (
              <div key={label} className="bg-white p-5 text-center">
                <div className="text-2xl font-extrabold" style={{ color: "#1b98e0" }}>
                  {num}
                </div>
                <div className="text-xs mt-1" style={{ color: "#247ba0" }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ ЗАЩО ============ */}
      <section className="py-16 bg-white border-y border-gray-100">
        <div className="max-w-4xl mx-auto px-5">
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#1b98e0" }}>
            Защо изобщо
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight" style={{ color: "#006494" }}>
            Празният имот не стои.
            <br />
            Той се поврежда.
          </h2>
          <p className="text-base mt-3 max-w-xl leading-relaxed" style={{ color: "#247ba0" }}>
            Щетите в необитавано жилище рядко идват наведнъж. Те се натрупват тихо месеци
            наред и се откриват, когато вече са скъпи.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
            {[
              ["💧", "Теч, който никой не чува", "Спукана връзка капе седмици. При обитаван имот се хваща за час. При празен — за три месеца, заедно с пода на съседа."],
              ["🌫️", "Влага и мухъл", "Без проветряване въздухът застоява. Мухълът тръгва от ъглите и до пролетта е по цялата стена."],
              ["🚱", "Изсъхнали сифони", "Водата в сифона се изпарява за седмици и канализацията започва да мирише директно в жилището."],
              ["👁️", "Личи си, че е празно", "Препълнена пощенска кутия и тъмни прозорци са покана. Редовното присъствие е най-евтината охрана."],
            ].map(([icon, title, desc]) => (
              <div key={title} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="text-2xl mb-3">{icon}</div>
                <h4 className="font-semibold text-sm" style={{ color: "#006494" }}>{title}</h4>
                <p className="text-xs mt-2 leading-relaxed" style={{ color: "#247ba0" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ АБОНАМЕНТИ ============ */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#1b98e0" }}>
            Три абонамента
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: "#006494" }}>
            Избираш за колко време
            <br />
            ти трябваме.
          </h2>
          <p className="text-base mt-3 max-w-xl leading-relaxed" style={{ color: "#247ba0" }}>
            Всеки абонамент е фиксиран чек-лист. Няма „минахме, всичко беше наред" — има
            точки, които или са отметнати със снимка, или не са.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-9">
            {/* Годишен */}
            <div
              className="rounded-3xl p-7 text-white relative overflow-hidden flex flex-col"
              style={{ background: "linear-gradient(145deg, #1b98e0, #006494 55%, #004a70)" }}
            >
              <span className="absolute top-5 right-5 bg-white/90 text-xs font-bold px-3 py-1 rounded-full" style={{ color: "#006494" }}>ПРЕПОРЪЧАН</span>
              <div className="text-xs font-bold uppercase tracking-widest opacity-70">◇ Целогодишно</div>
              <h3 className="text-2xl font-bold mt-2">Пълен надзор</h3>
              <p className="text-sm mt-2 opacity-80 leading-relaxed">
                Имотът е гледан 12 месеца без прекъсване. Чек-листът се сменя според сезона.
              </p>
              <div className="flex items-baseline gap-1.5 mt-5">
                <span className="text-4xl font-extrabold">120</span>
                <span className="text-sm opacity-70">лв / месец</span>
              </div>
              <p className="text-xs mt-1 opacity-65">2 обхода месечно</p>
              <ul className="mt-5 space-y-2 text-sm opacity-90 border-t border-white/20 pt-4 flex-1">
                <li className="flex gap-2"><span>✓</span> Зимен режим ноември–март</li>
                <li className="flex gap-2"><span>✓</span> Летен режим април–октомври</li>
                <li className="flex gap-2"><span>✓</span> Присъствие при майстор</li>
                <li className="flex gap-2"><span>✓</span> Приоритет при спешна проверка</li>
                <li className="flex gap-2"><span>✓</span> Оферта до 24 часа</li>
              </ul>
              <Link href="/login" className="mt-5 w-full py-3 rounded-xl bg-white text-center font-semibold text-sm hover:opacity-95 transition" style={{ color: "#006494" }}>
                Виж приложението
              </Link>
            </div>

            {/* Зимен */}
            <div
              className="rounded-3xl p-7 text-white relative overflow-hidden flex flex-col"
              style={{ background: "linear-gradient(145deg, #247ba0, #1a5f7e 55%, #13465e)" }}
            >
              <div className="text-xs font-bold uppercase tracking-widest opacity-70">❄ Ноември–Март</div>
              <h3 className="text-2xl font-bold mt-2">Зимен сезон</h3>
              <p className="text-sm mt-2 opacity-80 leading-relaxed">
                Месеците, в които празният имот се поврежда сам — влага, мухъл, замръзнала тръба.
              </p>
              <div className="flex items-baseline gap-1.5 mt-5">
                <span className="text-4xl font-extrabold">80</span>
                <span className="text-sm opacity-70">лв / месец</span>
              </div>
              <p className="text-xs mt-1 opacity-65">2 обхода месечно · ~40 мин</p>
              <ul className="mt-5 space-y-2 text-sm opacity-90 border-t border-white/20 pt-4 flex-1">
                <li className="flex gap-2"><span>✓</span> Проветряване на всички помещения</li>
                <li className="flex gap-2"><span>✓</span> Проверка за влага и мухъл</li>
                <li className="flex gap-2"><span>✓</span> Пускане на водата</li>
                <li className="flex gap-2"><span>✓</span> Отчитане на температура</li>
                <li className="flex gap-2"><span>✓</span> Прибиране на пощата</li>
              </ul>
              <Link href="/login" className="mt-5 w-full py-3 rounded-xl bg-white text-center font-semibold text-sm hover:opacity-95 transition" style={{ color: "#247ba0" }}>
                Виж приложението
              </Link>
            </div>

            {/* Летен */}
            <div
              className="rounded-3xl p-7 text-white relative overflow-hidden flex flex-col"
              style={{ background: "linear-gradient(145deg, #2a8c7a, #1f6b5c 55%, #154a3e)" }}
            >
              <div className="text-xs font-bold uppercase tracking-widest opacity-70">☀ Април–Октомври</div>
              <h3 className="text-2xl font-bold mt-2">Летен сезон</h3>
              <p className="text-sm mt-2 opacity-80 leading-relaxed">
                По-спокойните месеци, но не и празни — жега, влага от бури, двор и тераса.
              </p>
              <div className="flex items-baseline gap-1.5 mt-5">
                <span className="text-4xl font-extrabold">95</span>
                <span className="text-sm opacity-70">лв / месец</span>
              </div>
              <p className="text-xs mt-1 opacity-65">2 обхода месечно · ~1 ч</p>
              <ul className="mt-5 space-y-2 text-sm opacity-90 border-t border-white/20 pt-4 flex-1">
                <li className="flex gap-2"><span>✓</span> Обход на всички зони</li>
                <li className="flex gap-2"><span>✓</span> Проверка за течове след дъжд</li>
                <li className="flex gap-2"><span>✓</span> Тераса, двор и улуци</li>
                <li className="flex gap-2"><span>✓</span> Климатик — пробно пускане</li>
                <li className="flex gap-2"><span>✓</span> Поливане при заявка</li>
              </ul>
              <Link href="/login" className="mt-5 w-full py-3 rounded-xl bg-white text-center font-semibold text-sm hover:opacity-95 transition" style={{ color: "#2a8c7a" }}>
                Виж приложението
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============ ДОПЪЛНИТЕЛНИ ПАКЕТИ ============ */}
      <section className="py-16 bg-white border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#a663cc" }}>
            Допълнителни услуги
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: "#006494" }}>
            Всичко, което имотът
            <br />
            ти поиска.
          </h2>
          <p className="text-base mt-3 max-w-xl leading-relaxed" style={{ color: "#247ba0" }}>
            Няма нужда да търсиш три различни фирми. Ние сме на място и знаем имота.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
            {[
              ["🧹", "Почистване", "Основно, разширено или след ремонт. С твой препарат или с наш.", "от 60 лв"],
              ["🔧", "Ремонти", "Организираме майстор, присъстваме, проверяваме. Ти само одобряваш.", "от 30 лв/час"],
              ["❄️", "Зимна консервация", "Подготовка за зимата — вода, отопление, улуци, уплътнения.", "120 лв еднократно"],
              ["🔍", "Инспекция", "Преди покупка или след ремонт. Пълен оглед със снимки и доклад.", "от 90 лв"],
            ].map(([icon, title, desc, price]) => (
              <div
                key={title}
                className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:translate-y-[-3px] hover:shadow-md transition-all"
              >
                <div className="text-2xl mb-3">{icon}</div>
                <h3 className="font-bold text-base" style={{ color: "#006494" }}>{title}</h3>
                <p className="text-xs mt-2 leading-relaxed" style={{ color: "#247ba0" }}>{desc}</p>
                <div className="flex items-baseline gap-1 mt-4">
                  <span className="text-xl font-extrabold" style={{ color: "#1b98e0" }}>{price.split(" ")[0]}</span>
                  <span className="text-xs font-semibold" style={{ color: "#247ba0" }}>{price.split(" ").slice(1).join(" ")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ КОНТАКТ ============ */}
      <section className="py-16" id="contact">
        <div className="max-w-5xl mx-auto px-5">
          <div className="rounded-3xl p-10 sm:p-14 text-white text-center relative overflow-hidden"
            style={{ background: "linear-gradient(140deg, #1b98e0, #006494 60%, #004a70)" }}>
            <div className="absolute top-[-80px] right-[-50px] w-[250px] h-[250px] rounded-full bg-white/7" />
            <h2 className="relative text-3xl sm:text-4xl font-bold tracking-tight">
              Имотът ти не може да чака.
            </h2>
            <p className="relative mt-3 text-base opacity-85 max-w-md mx-auto leading-relaxed">
              Остави ни телефон и ще се обадим до края на деня. Без ангажимент.
            </p>
            <div className="relative mt-7 flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="tel"
                placeholder="+359 88 ..."
                className="flex-1 px-5 py-3.5 rounded-xl text-base border-0 outline-none"
                style={{ color: "#006494", fontSize: "16px" }}
              />
              <button className="px-6 py-3.5 rounded-xl bg-white font-semibold text-base hover:opacity-95 transition"
                style={{ color: "#006494" }}>
                Изпрати →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="py-10 text-center text-sm" style={{ color: "#247ba0" }}>
        © {new Date().getFullYear()} Ко Манда — стопанисване на имоти
        <br />
        <span style={{ color: "#a663cc" }}>comanda.blv.bg</span>
      </footer>
    </div>
  );
}
