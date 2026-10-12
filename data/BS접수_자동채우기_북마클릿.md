# BS 접수 자동 채우기 (북마클릿)

(주)비에스 접수 화면(`bscall.co.kr/request/funeral`)의 칸을
화환 시스템 값으로 **대신 채워 줍니다.**

> **접수 버튼은 누르지 않습니다.** 채우기만 하고, 내용을 눈으로 확인한 뒤
> **직접 [접수]를 누르셔야** 합니다. 잘못 들어가면 엉뚱한 빈소로 화환이 갑니다.

---

## 쓰는 순서

1. **화환 시스템**에서 BS 건을 열고 **[BS 접수서 복사]** 를 누릅니다
2. **bscall** 접수 화면(`request/funeral`)을 엽니다
3. 즐겨찾기 **[BS 채우기]** 를 누릅니다
4. 채워진 내용을 **확인**하고 직접 **[접수]**

클립보드로 넘깁니다. 주소(URL)에 싣지 않습니다 — 개인정보가 브라우저 기록에 남기 때문입니다.

---

## 무엇이 채워지나

| BS 접수 칸 | 화환에서 |
|---|---|
| 대상자 성명 · 연락처 · 소속부서 · 직책 · 사원번호 | BS 대상자 정보 5칸 |
| 경조사유 | 발송사유 (선택지 글자로 맞춤) |
| 고인성함 | 故고인 |
| 지역선택 | 장례식장명에서 추정 (선택지 글자로 맞춤) |
| 장례식장명 · 층/호실 | 빈소 한 칸을 둘로 나눔 |
| 지원물품 (상조용품 · 근조기 · 근조 3단 화환) | 수량 칸을 읽어 체크 |
| 보내는분 화환문구 | **고정** — `(재)FITI 시험연구원 원장 윤주경` |
| 경조사어 | **고정** — `삼가 故人의 冥福을 빕니다` |
| 부고링크 | 부고안내 |

**칸 이름이 아니라 라벨 글자로 찾습니다.** 사이트가 칸 이름을 바꿔도 라벨만 그대로면 계속 동작합니다.

---

## 즐겨찾기 만들기

즐겨찾기 막대 우클릭 → **페이지 추가** → 이름 `BS 채우기`, URL 칸에 아래를 통째로:

```
javascript:(async function(){try{var t=await navigator.clipboard.readText();var d=JSON.parse(t);if(!d||d._!=='FITI-BS'){alert('화환 시스템에서 [BS 접수서 복사]를 먼저 눌러 주세요.');return;}var miss=[];function all(){return [].slice.call(document.querySelectorAll('input,select,textarea'))}function lab(el){var s='';if(el.labels&&el.labels[0])s=el.labels[0].innerText;if(!s){var p=el.closest('div,li,tr,td,th');for(var i=0;i<4&&p;i++){var tx=(p.innerText||'').split('\n')[0];if(tx&&tx.length<30){s=tx;break}p=p.parentElement}}return (s||'').replace(/\s+/g,'').replace(/\*/g,'')}function find(names,types){var list=all();for(var n=0;n<names.length;n++){for(var i=0;i<list.length;i++){var e=list[i];if(types&&types.indexOf(e.tagName)<0)continue;if(e.type==='hidden')continue;var L=lab(e),P=(e.placeholder||'').replace(/\s+/g,'');if(L.indexOf(names[n])>=0||P.indexOf(names[n])>=0)return e}}return null}function setV(el,v){if(!el||v==null||v==='')return false;var p=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value');if(p&&p.set)p.set.call(el,v);else el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true}function fill(names,v,label){var e=find(names,['INPUT','TEXTAREA']);if(!setV(e,v))miss.push(label||names[0]);}function pick(names,v,label){var s=find(names,['SELECT']);if(!s||!v){miss.push(label||names[0]);return}var want=String(v).replace(/\s+/g,'');var best=null;for(var i=0;i<s.options.length;i++){var o=s.options[i],ot=(o.text||'').replace(/\s+/g,'');if(!ot||!o.value)continue;if(ot===want){best=o;break}if(!best&&(ot.indexOf(want)>=0||want.indexOf(ot)>=0))best=o}if(best){s.value=best.value;s.dispatchEvent(new Event('change',{bubbles:true}))}else miss.push((label||names[0])+'(선택지 없음)')}
fill(['대상자성명'],d.대상자성명);fill(['대상자연락처'],d.대상자연락처);fill(['소속부서'],d.소속부서);fill(['직책'],d.직책);fill(['사원번호'],d.사원번호);pick(['경조사유'],d.경조사유);fill(['고인성함'],d.고인성함);pick(['지역선택','지역'],d.장례식장명);fill(['장례식장명'],d.장례식장명);fill(['층/호실','층호실','호실'],d.층호실);fill(['보내는분화환문구','화환문구'],d.보내는분문구);pick(['경조사어'],d.경조사어);fill(['부고링크'],d.부고링크);
var g=d.지원물품||{};function chk(word,on,qty){var boxes=[].slice.call(document.querySelectorAll('input[type=checkbox]'));for(var i=0;i<boxes.length;i++){var b=boxes[i];if(lab(b).indexOf(word)<0)continue;if(b.disabled)return;if(!!b.checked!==!!on){b.click()}if(on&&qty){var row=b.closest('div,li,tr');for(var k=0;k<4&&row;k++){var q=row.querySelector('input[type=number],input[type=text]:not([type=checkbox])');if(q&&q!==b){setV(q,String(qty));break}row=row.parentElement}}return}miss.push(word)}
chk('상조',g.상조용품,g.상조용품수량);chk('근조기',g.근조기,g.근조기수량);chk('근조3단',g.근조화환);
alert('채웠습니다.'+(miss.length?'\n\n못 채운 칸:\n · '+miss.join('\n · ')+'\n\n직접 확인해 주세요.':'')+'\n\n내용을 확인하신 뒤 [접수]를 직접 눌러 주세요.');}catch(e){alert('채우기 실패: '+e.message+'\n\n화환에서 [BS 접수서 복사]를 먼저 누르셨는지 확인해 주세요.')}})();
```

> 저장한 뒤 즐겨찾기를 **우클릭 → 수정**해서 `javascript:` 로 시작하는지 확인하세요.
> 크롬이 가끔 이 앞부분을 떼어 버립니다.

---

## 잘 안 될 때

| 보이는 것 | 뜻 | 조치 |
|---|---|---|
| 「화환 시스템에서 [BS 접수서 복사]를 먼저…」 | 클립보드가 비었거나 다른 내용 | 화환에서 복사 버튼을 먼저 |
| 「못 채운 칸: …」 | 그 라벨을 못 찾음 | 해당 칸 **캡처**를 전략구매팀에 |
| 「경조사유(선택지 없음)」 | 우리 발송사유와 BS 선택지 글자가 다름 | 드롭다운 캡처를 주시면 대응표를 넣습니다 |
| 클립보드 읽기 거부 | 크롬이 권한을 물음 | **허용**을 누르세요 |

**지원물품 수량**은 체크박스 옆 숫자칸을 찾아 넣습니다. 화면 구조가 다르면 수량만 직접 고치시면 됩니다.

---

## 고정값 바꾸기

화환 `index.html` 안의 이 두 줄입니다.

```javascript
const BS_SENDER_TEXT = '(재)FITI 시험연구원 원장 윤주경';   // 보내는분 화환문구
const BS_CONDOLENCE  = '삼가 故人의 冥福을 빕니다';          // 경조사어
```
