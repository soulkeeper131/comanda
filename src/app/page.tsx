import Link from "next/link";
import InquiryForm from "@/components/InquiryForm";
import { Icon, type IconName } from "@/components/ui/Icon";
import { coreItem, loadBookableServices, loadCatalog, type BookableService, type CatalogPackage } from "@/lib/catalog";
import { perMonthLabel, seasonLabel } from "@/lib/format";
import { companyInfo } from "@/lib/legal";
import "./landing.css";

export const dynamic = "force-dynamic";

/** 60 → "60", 12.5 → "12,50" — голямата цифра в картите. */
function amount(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",");
}

/** „Стени и ъгли — без влага и мухъл" → „Стени и ъгли". */
const short = (label: string) => label.split(" — ")[0].trim();
const lower = (s: string) => s.charAt(0).toLocaleLowerCase("bg") + s.slice(1);
const upperFirst = (s: string) => s.charAt(0).toLocaleUpperCase("bg") + s.slice(1);

/**
 * Какво се проверява — от истинския чек-лист на пакета. Целогодишният
 * показва какво добавят зимата и лятото; сезонният — своите точки първо.
 */
function highlights(pkg: CatalogPackage): { season: string[]; always: string[] } {
  const steps = coreItem(pkg)?.checklist ?? [];
  const winter = steps.filter((s) => s.season === "winter").map((s) => short(s.label));
  const summer = steps.filter((s) => s.season === "summer").map((s) => short(s.label));
  const always = steps.filter((s) => s.season === "all").map((s) => short(s.label));
  if (!pkg.active_from) {
    return {
      season: [
        ...(winter.length ? [`Зимата още: ${winter.map(lower).join(", ")}`] : []),
        ...(summer.length ? [`Лятото още: ${summer.map(lower).join(", ")}`] : []),
      ],
      always: always.slice(0, 4),
    };
  }
  return { season: [...winter, ...summer], always: always.slice(0, Math.max(2, 7 - winter.length - summer.length)) };
}

function cardTheme(pkg: CatalogPackage): string {
  if (!pkg.active_from) return "l-year";
  return pkg.active_from >= "05-01" && pkg.active_from < "10-01" ? "l-summer" : "l-winter";
}

const SERVICE_ICON: Record<string, IconName> = {
  "Проверка след буря": "cloud",
  "Присъствие при майстор": "wrench",
  "Поливане и грижа за двора": "droplet",
  "Зимна консервация": "snowflake",
  "Приемане на доставка": "package",
  "Фотоотчет за трета страна": "camera",
};
const CATEGORY_ICON: Record<string, IconName> = {
  inspection: "search",
  cleaning: "home",
  repair: "wrench",
  conservation: "shield",
  garden: "droplet",
  custom: "clipboard",
};

const HOW: [IconName, string, string][] = [
  ["home", "Профил и имот", "Добавяш адреса, контакт на място и как се влиза. Проверяваме имота и му възлагаме инспектор."],
  ["package", "Избираш пакет", "Целогодишен или за сезона, с ясен чек-лист. Плащаш с карта или по банка — само за месеците, в които работим."],
  ["calendar", "Първият обход", "Обаждаме се и уговаряме деня. После графикът върви сам, а ти можеш да местиш обходи от телефона."],
  ["camera", "Отчет след всеки обход", "Снимка за всяка проверена точка. Спешното — теч, ток — стига до теб веднага като известие."],
];

const FAQ: [string, string][] = [
  ["Как плащам?", "С карта — първият месец при заявката, после автоматично всеки месец. Или по банков превод — пращаме ти данните за всеки месец. За всяко плащане получаваш фактура по имейл."],
  ["Плащам ли, когато сезонът свърши?", "Не. Сезонните пакети се плащат само за месеците в сезона — извън него няма обходи и няма такси. Ако заявиш преди сезона, първото плащане е в първия му ден."],
  ["Мога ли да се откажа?", "По всяко време, от приложението. Обслужването продължава до края на платения период. Ако още не сме идвали, връщаме платеното."],
  ["Какво става, ако открием проблем?", "Снимаме го и го описваме още на място — виждаш го веднага, а спешното (теч, ток, опасност) идва като известие на телефона. Поискаш ли, пращаме оферта с цена и срок. Решаваш ти."],
  ["Кой влиза в имота?", "Инспекторът, възложен на твоя имот. Ключовете и кода за входа описваш в приложението — виждат ги само той и екипът."],
  ["Мога ли да преместя обход?", "Да, от приложението — до 14 дни след датата му. Инспекторът разбира веднага."],
  ["Има ли договор и фактура?", "Приемаш общите условия при регистрацията, а за всяко плащане получаваш фактура — на името на фирмата, ако си фирма."],
];

/**
 * Публичната страница. Пакетите, чек-листите и услугите идват от каталога
 * в базата — същите, които клиентът вижда и плаща след регистрация; щом
 * админът смени цена или спре услуга, сайтът го показва веднага.
 */
export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  let catalog: CatalogPackage[] = [];
  let services: BookableService[] = [];
  try {
    catalog = loadCatalog();
    services = loadBookableServices();
  } catch {
    /* празна база — страницата се показва без каталога */
  }
  const recommended = catalog.find((p) => !p.active_from)?.id ?? catalog[0]?.id;
  const contactEmail = companyInfo().email || "vladimir.jotov@gmail.com";
  const inquiryOptions = [...catalog.map((p) => p.name), ...services.map((s) => s.name), "Друго"];

  return (
    <>
      <nav className="l-nav">
        <div className="l-wrap">
          <Link href="/" className="brand" aria-label="Ко Манда — начало">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="КОМАНДА" />
          </Link>
          <div className="l-links">
            <a href="#how">Как работи</a>
            <a href="#packages">Пакети</a>
            <a href="#services">Услуги</a>
            <a href="#faq">Въпроси</a>
          </div>
          <div className="spacer" />
          <Link href="/login" className="l-btn l-btn-g l-nav-btn">
            Вход
          </Link>
          <Link href="/register" className="l-btn l-btn-p l-nav-btn">
            Регистрация
          </Link>
        </div>
      </nav>

      {deleted === "1" && (
        <p role="status" style={{ background: "#e8f1f2", color: "#006494", textAlign: "center", padding: "12px 16px", fontSize: 15 }}>
          Профилът ви е изтрит. Благодарим, че бяхте с нас.
        </p>
      )}

      {/* ============ HERO ============ */}
      <header className="l-hero">
        <div className="l-wrap l-hero-grid">
          <div className="l-hero-text">
            <div className="l-badge">
              <span className="d" />
              Снимка за всяка проверена точка
            </div>
            <h1 className="l-h1">
              Имотът ти стои празен.
              <br />
              <em>Не и без надзор.</em>
            </h1>
            <p className="l-sub">
              Грижим се за жилища и вили, докато собственикът е в друг град или друга държава: редовни обходи,
              проветряване, проверка за течове и влага, зимна консервация и организиране на ремонти. След всеки
              обход получаваш отчет със снимки, час и потвърдена локация.
            </p>
            <div className="l-cta">
              <a href="#packages" className="l-btn l-btn-p">
                Виж пакетите
              </a>
              <a href="#contact" className="l-btn l-btn-g">
                Изпрати запитване
              </a>
            </div>
            <div className="l-strip">
              <div>
                <div className="n">2×</div>
                <div className="l">обхода месечно по абонамент</div>
              </div>
              <div>
                <div className="n">100%</div>
                <div className="l">от обходите — със снимков отчет</div>
              </div>
              <div>
                <div className="n">75 м</div>
                <div className="l">потвърдена локация при влизане</div>
              </div>
              <div>
                <div className="n">Веднага</div>
                <div className="l">спешните сигнали стигат до теб</div>
              </div>
            </div>
          </div>

          <ReportMock />
        </div>
      </header>

      {/* ============ КАК РАБОТИ ============ */}
      <section className="l-sec l-sec-alt" id="how">
        <div className="l-wrap">
          <div className="l-eyebrow">Как работи</div>
          <h2 className="l-h2">
            Четири стъпки
            <br />и имотът е под око.
          </h2>
          <div className="l-how">
            {HOW.map(([icon, title, text], i) => (
              <div key={title} className="l-how-step">
                <span className="n" aria-hidden>
                  {i + 1}
                </span>
                <div className="ic">
                  <Icon name={icon} size={22} />
                </div>
                <h4>{title}</h4>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ ЗАЩО ============ */}
      <section className="l-sec" id="why">
        <div className="l-wrap">
          <div className="l-eyebrow">Защо изобщо</div>
          <h2 className="l-h2">
            Празният имот не стои.
            <br />
            Той се поврежда.
          </h2>
          <p className="l-lead">
            Щетите в необитавано жилище рядко идват наведнъж. Натрупват се тихо месеци наред и се откриват, когато
            вече са скъпи.
          </p>
          <div className="l-risks">
            {(
              [
                ["droplet", "Теч, който никой не чува", "Спукана връзка капе седмици. В обитаван имот се хваща за час, в празен — след месеци, заедно с тавана на съседа отдолу."],
                ["cloud", "Влага и мухъл", "Без проветряване въздухът застоява. Мухълът тръгва от ъглите и первазите и до пролетта е по цялата стена."],
                ["snowflake", "Замръзнала тръба", "Изключено отопление в студена нощ и водата в тръбите замръзва. Пукнатината се вижда чак когато се размрази."],
              ] as [IconName, string, string][]
            ).map(([icon, title, text]) => (
              <div key={title} className="l-risk relative">
                <div className="ic" style={{ position: "absolute", left: "auto", right: 12, top: 10, opacity: 0.12, pointerEvents: "none", lineHeight: 1 }}>
                  <Icon name={icon} size={42} />
                </div>
                <h4>{title}</h4>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ ПАКЕТИ ============ */}
      <section className="l-sec l-sec-alt" id="packages">
        <div className="l-wrap">
          <div className="l-eyebrow">Абонаменти</div>
          <h2 className="l-h2">
            Избираш за колко време
            <br />
            ти трябваме.
          </h2>
          <p className="l-lead">
            Всеки пакет е фиксиран чек-лист. Няма „минахме, всичко беше наред&rdquo; — има точки, които са отметнати
            със снимка или не са.
          </p>

          {catalog.length === 0 ? (
            <p className="l-pkg-note">Пакетите се зареждат — пиши ни през формата по-долу.</p>
          ) : (
            <div className="l-subs">
              {catalog.map((pkg) => {
                const h = highlights(pkg);
                const core = coreItem(pkg);
                const options = pkg.items.filter((i) => i.optional);
                const seasonal = Boolean(pkg.active_from && pkg.active_to);
                return (
                  <div key={pkg.id} className={`l-sub-card ${cardTheme(pkg)}`}>
                    {pkg.id === recommended && <div className="l-tag">ПРЕПОРЪЧАН</div>}
                    <div className="season">{seasonal ? seasonLabel(pkg.active_from, pkg.active_to) : "Целогодишно"}</div>
                    <h3>{pkg.name}</h3>
                    {pkg.description && <div className="d">{pkg.description}</div>}
                    <div className="l-sub-price">
                      <span className="v">{amount(pkg.price)}</span>
                      <span className="u">€ / месец</span>
                    </div>
                    <div className="cad">
                      {upperFirst(perMonthLabel(pkg.per_month))}
                      {core && core.steps > 0 ? ` · ${core.steps} точки в чек-листа` : ""}
                    </div>
                    <ul className="l-sub-feats">
                      {h.season.map((x) => (
                        <li key={x} className={pkg.active_from ? undefined : "l-sub-season"}>
                          {x}
                        </li>
                      ))}
                      {h.always.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                      <li>Спешните сигнали стигат до теб веднага</li>
                    </ul>
                    {(seasonal || options.length > 0) && (
                      <div className="l-sub-extra">
                        {seasonal && <div>Плащаш само месеците в сезона.</div>}
                        {options.map((o) => (
                          <div key={o.id}>
                            + {o.template_name} ({perMonthLabel(o.per_month)}) — {amount(o.extra_price)} € / месец
                          </div>
                        ))}
                      </div>
                    )}
                    <Link href={`/register?plan=${encodeURIComponent(pkg.name)}`} className="l-btn">
                      Започни с „{pkg.name}“
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
          <p className="l-pkg-note">Цените са крайни. Пълния чек-лист виждаш в приложението, преди да платиш.</p>
        </div>
      </section>

      {/* ============ УСЛУГИ ============ */}
      <section className="l-sec" id="services">
        <div className="l-wrap">
          <div className="l-eyebrow">Извън абонамента</div>
          <h2 className="l-h2">
            Заявяваш от приложението,
            <br />
            когато потрябва.
          </h2>
          <p className="l-lead">Еднократно, на избраната дата. Плащаш предварително — с карта или по банка — и получаваш отчет като от всеки обход.</p>
          <div className="l-svcs">
            {services.map((s) => (
              <div key={s.id} className="l-svc">
                <div className="ic">
                  <Icon name={SERVICE_ICON[s.name] ?? CATEGORY_ICON[s.category] ?? "clipboard"} size={20} />
                </div>
                <h4>{s.name}</h4>
                {s.description && <p>{s.description}</p>}
                <div className="price">
                  <span className="v">{amount(s.price)} €</span>
                  <span className="u">еднократно</span>
                </div>
              </div>
            ))}
            <div className="l-svc">
              <div className="ic">
                <Icon name="wrench" size={20} />
              </div>
              <h4>Ремонт по оферта</h4>
              <p>Открием ли проблем при обход, получаваш цена, срок и обхват в писмен вид. Приемеш ли — организираме майстора и присъстваме.</p>
              <div className="price">
                <span className="u">по оферта</span>
              </div>
            </div>
            <a href="#contact" className="l-svc l-svc-alt" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="ic">
                <Icon name="edit" size={20} />
              </div>
              <h4>Нещо друго?</h4>
              <p>Опиши какво ти трябва в запитването — връщаме цена и срок до 24 часа.</p>
              <div className="price">
                <span className="u">по запитване →</span>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* ============ РЕМОНТИ ============ */}
      <section className="l-sec l-sec-alt" id="repairs">
        <div className="l-wrap">
          <div className="l-eyebrow">Когато се открие нещо</div>
          <h2 className="l-h2">
            Научаваш го от нас,
            <br />
            докато още е евтино.
          </h2>
          <p className="l-lead">Констатацията не отива в графа „други бележки&rdquo;. Тръгва процес, който виждаш стъпка по стъпка от телефона си.</p>
          <div className="l-flow">
            {[
              ["СТЪПКА 1", "Констатация", "Инспекторът снима намереното още на място и го описва. Отива при теб веднага."],
              ["СТЪПКА 2", "Искаш ли оферта?", "Ти решаваш. Може да го оставиш под наблюдение или да поискаш цена за отстраняване."],
              ["СТЪПКА 3", "Оферта с цена и срок", "Получаваш какво ще се направи, колко струва и за колко дни. Без обаждания и без чакане."],
              ["СТЪПКА 4", "Приемаш или отказваш", "При приемане организираме майстора. Отчетът е със снимки, както всеки обход."],
            ].map(([step, title, desc]) => (
              <div key={step} className="l-fstep">
                <div className="n">{step}</div>
                <h4>{title}</h4>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ ДОКАЗАТЕЛСТВА ============ */}
      <section className="l-sec" id="proof">
        <div className="l-wrap">
          <div className="l-eyebrow">Защо да ни вярваш</div>
          <h2 className="l-h2">
            Не можеш да провериш.
            <br />
            Затова показваме всичко.
          </h2>
          <p className="l-lead">Ти си на стотици километри. Всеки може да каже, че е минал — ние ти показваме кога, къде и какво.</p>
          <div className="l-proof">
            {(
              [
                ["pin", "Потвърдена локация", "Обходът започва само когато телефонът на инспектора е до имота. Записват се часът на влизане и на излизане."],
                ["camera", "Снимка за всяка точка", "Точките от чек-листа се отмятат със снимка от мястото и часа ѝ. Без снимка обходът не приключва."],
                ["check", "Всичко е при теб", "Отчетът идва след всеки обход. Проблем — искаш оферта или го оставяш под наблюдение. Решаваш ти."],
              ] as [IconName, string, string][]
            ).map(([icon, title, text]) => (
              <div key={title} className="l-pcard relative">
                <div className="ic" style={{ position: "absolute", left: "auto", right: 12, top: 10, opacity: 0.12, pointerEvents: "none", lineHeight: 1, width: "auto", height: "auto", background: "none", borderRadius: 0 }}>
                  <Icon name={icon} size={42} />
                </div>
                <h4>{title}</h4>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ ВЪПРОСИ ============ */}
      <section className="l-sec l-sec-alt" id="faq">
        <div className="l-wrap" style={{ maxWidth: 820 }}>
          <div className="l-eyebrow">Често питат</div>
          <h2 className="l-h2">Въпроси</h2>
          <div className="l-faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <Icon name="chevron-down" size={20} className="chev" />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ============ ЗАПИТВАНЕ ============ */}
      <section className="l-sec" id="contact">
        <div className="l-wrap">
          <div className="l-form-grid">
            <div>
              <div className="l-eyebrow">Запитване</div>
              <h2 className="l-h2">
                Кажи ни за имота.
                <br />
                Връщаме оферта.
              </h2>
              <p className="l-lead">
                Отговаряме до 24 часа с конкретна цена за твоя случай. Ако услугата, която търсиш, я няма в списъка — опиши
                я и ще кажем дали можем.
              </p>
              <div className="l-contact-note">
                <div className="row" style={{ alignItems: "flex-start", gap: 11 }}>
                  <div style={{ color: "var(--accent)" }}>
                    <Icon name="phone" size={20} />
                  </div>
                  <div>
                    <div className="strong small">Предпочиташ да се чуем?</div>
                    <div className="tiny muted" style={{ marginTop: 3 }}>
                      Остави телефон и час, в който ти е удобно — звъним ние, за да не плащаш международен разговор.
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <InquiryForm services={inquiryOptions} />
          </div>
        </div>
      </section>

      {/* ============ BAND ============ */}
      <section className="l-sec">
        <div className="l-wrap">
          <div className="l-band">
            <h2>Или си направи профил</h2>
            <p>Регистрираш имотите си, следиш обходите, получаваш офертите и виждаш снимките от всяко посещение.</p>
            <Link href="/register" className="l-btn">
              Създай профил →
            </Link>
          </div>
          <div className="l-foot">
            КОМАНДА — грижа за празни имоти
            <br />
            София ·{" "}
            <a href={`mailto:${contactEmail}`} style={{ color: "var(--accent)" }}>
              {contactEmail}
            </a>
            <br />
            <Link href="/terms" style={{ color: "var(--muted)", textDecoration: "underline", fontSize: "12.5px" }}>
              Общи условия
            </Link>
            {" · "}
            <Link href="/privacy" style={{ color: "var(--muted)", textDecoration: "underline", fontSize: "12.5px" }}>
              Поверителност
            </Link>
            <br />
            <Link href="/login" style={{ color: "var(--muted)", textDecoration: "underline", fontSize: "12.5px", marginTop: 8, display: "inline-block" }}>
              Вход в приложението
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

/** Пример как изглежда отчетът след обход — илюстрация, не истински имот. */
function ReportMock() {
  const rows: [string, string, string][] = [
    ["Вход", "Врата и брава — цели, заключено", "l-ph1"],
    ["Баня", "Проверка за течове", "l-ph2"],
    ["Общо", "Стени и ъгли — без влага и мухъл", "l-ph3"],
    ["Общо", "Отопление против замръзване", "l-ph4"],
    ["Вход", "Пощата е прибрана", "l-ph5"],
  ];
  return (
    <div className="l-mock" role="img" aria-label="Пример за отчет от обход: отметнати точки със снимки и открит проблем с бутон за оферта">
      <div className="l-mock-head">
        <div>
          <div className="l-mock-kicker">Отчет от обхода</div>
          <div className="l-mock-title">Апартамент, Лозенец</div>
          <div className="l-mock-meta">
            <Icon name="pin" size={14} /> В имота 10:34 – 11:15
          </div>
        </div>
        <span className="l-chip l-chip-ok">
          <Icon name="check" size={13} strokeWidth={3} /> Завършен
        </span>
      </div>
      <ul className="l-mock-rows">
        {rows.map(([zone, label, ph]) => (
          <li key={label} className="l-mock-row">
            <span className="l-mock-tick">
              <Icon name="check" size={14} strokeWidth={3} />
            </span>
            <span className="t">
              <span className="z">{zone}</span>
              {label}
            </span>
            <span className={`l-mock-photo ${ph}`}>
              <Icon name="camera" size={16} />
            </span>
          </li>
        ))}
      </ul>
      <div className="l-mock-finding">
        <span className="i">
          <Icon name="alert" size={20} />
        </span>
        <span className="t">Капе смесителят в кухнята</span>
        <span className="b">Искам оферта</span>
      </div>
      <div className="l-mock-foot">
        <span>14 точки · 12 снимки</span>
        <span>Изпратен на собственика</span>
      </div>
    </div>
  );
}
