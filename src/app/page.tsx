import Link from "next/link";
import HeroSection from "@/components/HeroSection";

export default function Home() {
  return (
    <>
      {/* ================= НАЧАЛНА СТРАНИЦА ================= */}
      <nav className="l-nav">
        <div className="l-wrap">
          <div className="brand">
            <img src="/logo.png" alt="КОМАНДА" style={{ height: 68, width: "auto", display: "block" }} />
          </div>
          <div className="spacer" />
          <Link href="/login" className="l-btn l-btn-g" style={{ padding: "10px 18px", fontSize: "14.5px" }}>
            Вход
          </Link>
          <Link href="/register" className="l-btn l-btn-p" style={{ padding: "10px 18px", fontSize: "14.5px" }}>
            Регистрация
          </Link>
        </div>
      </nav>

      <HeroSection />

      {/* ============ ЗАЩО ============ */}
      <section className="l-sec l-sec-alt" id="why">
        <div className="l-wrap">
          <div className="l-eyebrow">Защо изобщо</div>
          <h2 className="l-h2">
            Празният имот не стои.
            <br />
            Той се поврежда.
          </h2>
          <p className="l-lead">
            Щетите в необитавано жилище рядко идват наведнъж. Те се натрупват тихо
            месеци наред и се откриват, когато вече са скъпи.
          </p>

          <div className="l-risks">
            <div className="l-risk">
              <div className="ic">💧</div>
              <h4>Теч, който никой не чува</h4>
              <p>
                Спукана връзка капе седмици. При обитаван имот се хваща за час.
                При празен — за три месеца, заедно с пода на съседа отдолу.
              </p>
            </div>
            <div className="l-risk">
              <div className="ic">🌫️</div>
              <h4>Влага и мухъл</h4>
              <p>
                Без проветряване въздухът застоява. Мухълът тръгва от ъглите и первазите
                и до пролетта е по цялата стена.
              </p>
            </div>
            <div className="l-risk">
              <div className="ic">🚱</div>
              <h4>Изсъхнали сифони</h4>
              <p>
                Водата в сифона се изпарява за седмици и канализацията започва да мирише
                директно в жилището.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ АБОНАМЕНТИ ============ */}
      <section className="l-sec" id="packages">
        <div className="l-wrap">
          <div className="l-eyebrow">Три абонамента</div>
          <h2 className="l-h2">
            Избираш за колко време
            <br />
            ти трябваме.
          </h2>
          <p className="l-lead">
            Всеки абонамент е фиксиран чек-лист. Няма „минахме, всичко беше наред" —
            има точки, които или са отметнати със снимка, или не са.
          </p>

          <div className="l-subs">
            {/* Годишен */}
            <div className="l-sub-card l-year">
              <div className="l-tag">ПРЕПОРЪЧАН</div>
              <div className="season">◇ Целогодишно</div>
              <h3>Пълен надзор</h3>
              <div className="d">
                Имотът е гледан 12 месеца без прекъсване. Не мислиш кога започва
                сезонът и кога свършва — чек-листът се сменя сам.
              </div>
              <div className="l-sub-price">
                <span className="v">60</span>
                <span className="u">€ / месец</span>
              </div>
              <div className="cad">2 обхода месечно · чек-листът следва сезона</div>
              <ul className="l-sub-feats">
                <li>Зимен режим ноември – март</li>
                <li>Летен режим април – октомври</li>
                <li>Присъствие при майстор — 2 пъти месечно без доплащане</li>
                <li>Приоритет при спешна проверка</li>
                <li>Оферта за ремонт до 24 часа</li>
              </ul>
              <Link href="/register?plan=year" className="l-btn">
                Виж как изглежда
              </Link>
            </div>

            {/* Зимен */}
            <div className="l-sub-card l-winter">
              <div className="season">❄ Октомври – Април</div>
              <h3>Зимен сезон</h3>
              <div className="d">
                Месеците, в които празният имот се поврежда сам — влага, мухъл,
                изсъхнали сифони, замръзнала тръба.
              </div>
              <div className="l-sub-price">
                <span className="v">40</span>
                <span className="u">€ / месец</span>
              </div>
              <div className="cad">2 обхода месечно · около 40 мин всеки</div>
              <ul className="l-sub-feats">
                <li>Проветряване на всички помещения</li>
                <li>Проверка за влага, мухъл и течове</li>
                <li>Пускане на водата — сифоните да не изсъхнат</li>
                <li>Отчитане на температурата в жилището</li>
                <li>Прибиране на пощата</li>
                <li>Прозорци и врати заключени при тръгване</li>
              </ul>
              <Link href="/register?plan=winter" className="l-btn">
                Виж как изглежда
              </Link>
            </div>

            {/* Летен */}
            <div className="l-sub-card l-summer">
              <div className="season">☀ Май – Септември</div>
              <h3>Летен сезон</h3>
              <div className="d">
                По-спокойните месеци, но не и празни — жега, влага от бури,
                двор и тераса, които обрастват.
              </div>
              <div className="l-sub-price">
                <span className="v">50</span>
                <span className="u">€ / месец</span>
              </div>
              <div className="cad">2 обхода месечно · около 1 ч всеки</div>
              <ul className="l-sub-feats">
                <li>Проветряване и обход на всички зони</li>
                <li>Проверка за течове след дъжд и бури</li>
                <li>Състояние на тераса, двор и улуци</li>
                <li>Климатик — пробно пускане и филтри</li>
                <li>Поливане на растения при заявка</li>
                <li>Прибиране на пощата</li>
              </ul>
              <Link href="/register?plan=summer" className="l-btn">
                Виж как изглежда
              </Link>
            </div>
          </div>

          {/* ============ ДОПЪЛНИТЕЛНИ ПАКЕТИ ============ */}
          <div className="l-eyebrow" style={{ marginTop: 52 }}>
            Извън абонамента
          </div>
          <h3 style={{ fontSize: 20, marginTop: 8, letterSpacing: "-.02em" }}>
            Заявяваш от приложението, когато потрябва
          </h3>

          <div className="l-pkgs">
            {[
              ["hammer", "Присъствие при майстор", "Водопроводчик, електротехник, техник на асансьора, застрахователен оглед. Някой трябва да е там и да отчете какво е свършено.", "20", "€ / до 2 часа"],
              ["alert", "Извънредна проверка", "След буря, сигнал от съсед, спиране на тока или просто лошо предчувствие. Отиваме до 6 часа и пращаме снимки.", "25", "€ / посещение"],
              ["snow", "Зимна консервация", "Еднократна подготовка преди дълго отсъствие — спиране на вода, източване на инсталацията, режим на отоплението.", "75", "€ еднократно"],
              ["box", "Приемане на доставка", "Мебел, техника, пратка с подпис. Приемаме, проверяваме за щети и снимаме опаковката преди и след отваряне.", "15", "€ / доставка"],
              ["clean", "Почистване", "Поливане, косене на тревата, разчистване на листа. Добавя се към обхода или се заявява отделно.", "80", "€ / посещение"],
              ["camera", "Фотоотчет за трета страна", "Пълен снимков протокол за застраховател, банка, купувач или при спор със съсед. С дата, час и координати.", "20", "€ / протокол"],
              ["repair", "Ремонт по оферта", "Открием ли нещо при обход, получаваш цена, срок и обхват в писмен вид. Организираме майстора. Решаваш ти.", "по", "оферта"],
              ["custom", "Твоя услуга", "Нещо, което не е в списъка? Опиши какво ти трябва в запитването — връщаме цена и срок до 24 часа. Ако е изпълнимо, го правим.", "по", "заявка"],
            ].map(([theme, title, desc, price, unit], i) => (
              <div
                key={title}
                className={`l-pkg l-pkg--${theme}`}
                style={
                  i === 7
                    ? { borderStyle: "dashed", borderColor: "var(--accent)", background: "var(--accent-soft)" }
                    : undefined
                }
              >
                <h3>{title}</h3>
                <div className="desc">{desc}</div>
                <div className="l-price">
                  <span className="v">{price}</span>
                  <span className="u">{unit}</span>
                </div>
              </div>
            ))}
          </div>

          <p className="l-note" style={{ marginTop: 22 }}>
            Цените са примерни и зависят от квадратура и локация.
            При 3 и повече обекта — намаление на абонамента.
          </p>
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
          <p className="l-lead">
            Констатацията не отива в графа „други бележки". Тръгва процес,
            който виждаш стъпка по стъпка от телефона си.
          </p>

          <div className="l-flow">
            {[
              ["СТЪПКА 1", "Констатация", "Инспекторът снима намереното още на място и го описва. Отива при теб веднага."],
              ["СТЪПКА 2", "Искаш ли оферта?", "Ти решаваш. Може да го оставиш под наблюдение или да поискаш цена за отстраняване."],
              ["СТЪПКА 3", "Оферта с цена и срок", "Получаваш какво ще се направи, колко струва и за колко дни. Без обаждания и без чакане."],
              ["СТЪПКА 4", "Приемаш или отказваш", "При приемане организираме майстора и присъстваме. Отчетът е със снимки, както всеки обход."],
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

      {/* ============ ГАРАНЦИЯ ============ */}
      <section className="l-sec" id="proof">
        <div className="l-wrap">
          <div className="l-eyebrow">Защо да ни вярваш</div>
          <h2 className="l-h2">
            Не можеш да провериш.
            <br />
            Затова ние се проверяваме сами.
          </h2>
          <p className="l-lead">
            Ти си на 500 км. Всеки може да ти каже, че е минал.
            Затова системата събира три независими доказателства за всеки обход — и ти ги показва всичките.
          </p>

          <div className="l-proof">
            <div className="l-pcard">
              <div className="ic" style={{ background: "#EFF6FF" }}>📍</div>
              <h4>Потвърдена локация</h4>
              <p>
                Чек-листът се отключва само когато телефонът е физически в имота.
                Записва се час на влизане, на излизане и колко време е прекарано вътре.
              </p>
            </div>
            <div className="l-pcard">
              <div className="ic" style={{ background: "var(--accent-soft)" }}>📷</div>
              <h4>Снимки от място</h4>
              <p>
                Само през камерата в приложението — качване от галерия няма.
                Всяка снимка носи час и координати, вписани от сървъра, не от телефона.
              </p>
            </div>
            <div className="l-pcard">
              <div className="ic" style={{ background: "#FFFBEB" }}>✓</div>
              <h4>Последната дума е твоя</h4>
              <p>
                Преглеждаш отчета и приемаш, приемаш с бележка или оспорваш.
                Оспорването отваря казус със срок за отговор. Нищо не се затваря без теб.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ ЗАПИТВАНЕ ============ */}
      <section className="l-sec l-sec-alt" id="contact">
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
                Отговаряме до 24 часа с конкретна цена за твоя случай.
                Ако услугата, която търсиш, я няма в списъка — опиши я и ще кажем дали можем.
              </p>

              <div className="l-contact-note">
                <div className="row" style={{ alignItems: "flex-start", gap: 11 }}>
                  <div style={{ fontSize: 19 }}>📞</div>
                  <div>
                    <div className="strong small">Предпочиташ да се чуем?</div>
                    <div className="tiny muted" style={{ marginTop: 3 }}>
                      Остави телефон и час, в който ти е удобно —
                      звъним ние, за да не плащаш международен разговор.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="l-form">
              <div className="row" style={{ gap: 10 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label className="label">Име</label>
                  <input className="input" placeholder="Име и фамилия" />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label className="label">Телефон</label>
                  <input className="input" type="tel" placeholder="+359 …" />
                </div>
              </div>
              <div className="field">
                <label className="label">Имейл</label>
                <input className="input" type="email" placeholder="за да ти изпратим офертата" />
              </div>
              <div className="row" style={{ gap: 10 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label className="label">Град / район</label>
                  <input className="input" placeholder="напр. София, Лозенец" />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label className="label">Тип имот</label>
                  <select className="select" defaultValue="Апартамент">
                    <option>Апартамент</option>
                    <option>Студио</option>
                    <option>Къща</option>
                    <option>Вила</option>
                    <option>Офис</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label className="label">Какво те интересува</label>
                <select className="select" defaultValue="Пълен надзор — целогодишно">
                  <option>Пълен надзор — целогодишно</option>
                  <option>Зимен сезон</option>
                  <option>Летен сезон</option>
                  <option>Еднократна услуга</option>
                  <option>Друго — описвам по-долу</option>
                </select>
              </div>
              <div className="field">
                <label className="label">Разкажи накратко</label>
                <textarea
                  className="textarea"
                  placeholder="Откога е празен имотът, има ли известни проблеми, какво точно ти трябва"
                />
              </div>
              <button className="l-btn l-btn-p" style={{ width: "100%" }}>
                Изпрати запитването
              </button>
              <p className="tiny muted" style={{ marginTop: 11, textAlign: "center" }}>
                Отговаряме до 24 часа. Данните ти не отиват никъде другаде.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ BAND ============ */}
      <section className="l-sec">
        <div className="l-wrap">
          <div className="l-band">
            <h2>Или си направи профил</h2>
            <p>
              Регистрираш имотите си, следиш обходите, получаваш офертите
              и виждаш снимките от всяко посещение.
            </p>
            <Link href="/login" className="l-btn">
              Създай профил →
            </Link>
          </div>
          <div className="l-foot">
            КОМАНДА — стопанисване и управление на имоти
            <br />
            София ·{" "}
            <a href="mailto:vladimir.jotov@gmail.com" style={{ color: "var(--accent)" }}>
              vladimir.jotov@gmail.com
            </a>
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
