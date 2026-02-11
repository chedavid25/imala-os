document.addEventListener("DOMContentLoaded",function(){let E=window.Imala.db,y=window.Imala.auth,v=(y.onAuthStateChanged(e=>{e?((async()=>{let t=["Ventas","Honorarios","Otros"],i=["Alquiler","Expensas","Servicios","Sueldos","Impuestos","Otros"],n=["Fondo de Reserva","Inversión","Viajes","Bienes","Otros"];l={INCOME:[],EXPENSE:[],SAVING:[]};try{let a=E.collection("cashflow_categories");var e=await a.orderBy("createdAt","asc").get();let r={INCOME:new Set,EXPENSE:new Set,SAVING:new Set},o=E.batch(),c=!1;e.forEach(e=>{var t=e.data();let n=t.type;n||(n=i.includes(t.name)?"EXPENSE":"INCOME",o.update(e.ref,{type:n}),c=!0),r[n]||(r[n]=new Set),r[n].add(t.name),!1===t.active||l[n].includes(t.name)||l[n].push(t.name)});var s=(e,n)=>{e.forEach(e=>{var t;r[n].has(e)||(t=a.doc(),o.set(t,{name:e,type:n,active:!0,createdAt:new Date,createdBy:"SYSTEM"}),l[n].push(e),r[n].add(e),c=!0)})};s(t,"INCOME"),s(i,"EXPENSE"),s(n,"SAVING"),c&&(await o.commit(),console.log("Categorías sincronizadas y tipos actualizados permanentemente.")),l.INCOME.sort(),l.EXPENSE.sort(),l.SAVING.sort()}catch(e){console.error("Error loading categories:",e),0===l.INCOME.length&&(l.INCOME=[...t]),0===l.EXPENSE.length&&(l.EXPENSE=[...i]),0===l.SAVING.length&&(l.SAVING=[...n])}S("INCOME"),S("EXPENSE"),S("SAVING"),A()})(),(async()=>{let n=document.getElementById("list-entities-income"),r=document.getElementById("list-entities-expense");n&&(n.innerHTML=""),r&&(r.innerHTML=""),I={INCOME:[],EXPENSE:[]};try{(await E.collection("cashflow_entities").orderBy("name").get()).forEach(e=>{let a=e.data();var e=a.type||"BOTH",t=(e,t)=>{var n;e&&((n=document.createElement("option")).value=a.name,e.appendChild(n),I[t].includes(a.name)||I[t].push(a.name))};"CLIENT"!==e&&"BOTH"!==e||t(n,"INCOME"),"PROVIDER"!==e&&"BOTH"!==e||t(r,"EXPENSE")})}catch(e){console.error("Error loading entities",e)}})(),x(),q(),E.collection("cashflow_accounts").where("uid","==",h()).onSnapshot(e=>{f=[],e.forEach(e=>f.push({id:e.id,...e.data()}));{let e=document.querySelectorAll(".select-account"),t=f.filter(e=>!1!==e.isActive);e.forEach(n=>{var e=n.value;n.innerHTML='<option value="">Seleccione cuenta...</option>',t.forEach(e=>{var t=document.createElement("option");t.value=e.id,t.textContent=e.name+` (${e.currency})`,n.appendChild(t)}),n.value=e})}{let n=document.getElementById("table-accounts-list");n.innerHTML="",f.forEach(e=>{var t;!1!==e.isActive&&((t=document.createElement("tr")).innerHTML=`
                <td>${e.name}</td>
                <td><span class="badge bg-soft-info text-info">${e.currency}</span></td>
                <td>${w(e.initialBalance,e.currency)}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-soft-primary btn-edit-account" data-id="${e.id}"><i class="mdi mdi-pencil"></i></button>
                    <button class="btn btn-sm btn-soft-danger btn-delete-account" data-id="${e.id}"><i class="mdi mdi-trash-can"></i></button>
                </td>
            `,n.appendChild(t))}),n.querySelectorAll(".btn-edit-account").forEach(t=>{t.addEventListener("click",()=>{var e=f.find(e=>e.id===t.dataset.id);e&&(document.getElementById("acc-id").value=e.id,document.getElementById("acc-name").value=e.name,document.getElementById("acc-currency").value=e.currency,document.getElementById("acc-initial-balance").value=e.initialBalance,document.getElementById("title-account-form").textContent="Editar Cuenta")})}),n.querySelectorAll(".btn-delete-account").forEach(t=>{t.addEventListener("click",async()=>{var e=t.dataset.id;(await Swal.fire({title:"¿Eliminar cuenta?",text:"Se mantendrá el historial de movimientos pero no podrás usarla para nuevos registros.",icon:"warning",showCancelButton:!0,confirmButtonText:"Sí, desactivar",cancelButtonText:"Cancelar"})).isConfirmed&&(await E.collection("cashflow_accounts").doc(e).update({isActive:!1,updatedAt:new Date}),Swal.fire("Desactivada","La cuenta ha sido desactivada.","success"))})})}Q()})):window.location.href="auth-login.html"}),new bootstrap.Modal(document.getElementById("modal-income"))),p=new bootstrap.Modal(document.getElementById("modal-expense")),r=new bootstrap.Modal(document.getElementById("modal-saving")),m=new bootstrap.Modal(document.getElementById("modal-transfer-unified")),g=[],f=[],l={INCOME:[],EXPENSE:[],SAVING:[]},I={INCOME:[],EXPENSE:[]},b=[],t=!1,O=!1,d=!1,u={INCOME:{column:"date",direction:"desc"},EXPENSE:{column:"date",direction:"desc"},SAVING:{column:"date",direction:"desc"}},w=(e,t)=>new Intl.NumberFormat("es-AR",{style:"currency",currency:t}).format(e),h=()=>window.getEffectiveUID?window.getEffectiveUID():sessionStorage.getItem("effectiveUID")||y.currentUser.uid,B=e=>e?e.seconds?new Date(1e3*e.seconds):new Date(e):null;function S(e){let t="",n=("INCOME"===e?t="in-category":"EXPENSE"===e?t="ex-category":"SAVING"===e&&(t="sav-category"),document.getElementById(t));n&&(n.innerHTML='<option value="">Seleccione...</option>',l[e].forEach(e=>{n.innerHTML+=`<option value="${e}">${e}</option>`}))}function A(){let t=document.getElementById("filter-category");var e;t&&(e=t.value,t.innerHTML='<option value="ALL">Todas</option>',[...new Set([...l.INCOME,...l.EXPENSE])].sort().forEach(e=>{t.innerHTML+=`<option value="${e}">${e}</option>`}),e)&&(t.value=e)}[{check:"in-recurring",container:"container-in-installments"},{check:"ex-recurring",container:"container-ex-installments"},{check:"sav-recurring",container:"container-sav-installments"}].forEach(e=>{let t=document.getElementById(e.check),n=document.getElementById(e.container);t&&n&&t.addEventListener("change",()=>{var e;n.style.display=t.checked?"block":"none",t.checked||(e=n.querySelector("input"))&&(e.value="")})}),document.addEventListener("click",async t=>{t=t.target.closest("button");if(t){if(t.classList.contains("btn-add-category")){var n=t.dataset.type;let e="";"INCOME"===n?e="container-new-category-in":"EXPENSE"===n?e="container-new-category-ex":"SAVING"===n&&(e="container-new-category-sav");var n=document.getElementById(e);n&&(a=n.querySelector(".input-new-cat"),n.style.display="block",a)&&a.focus()}if(t.classList.contains("btn-cancel-new-cat")&&(n=t.closest(".container-new-cat"))&&(n.style.display="none"),t.classList.contains("btn-save-new-cat")){var a=t.dataset.type,n=t.closest(".container-new-cat"),e=n.querySelector(".input-new-cat"),r=e.value.trim();if(!r)return;var o=t,c=o.innerHTML;try{o.innerHTML='<i class="bx bx-loader bx-spin"></i>',o.disabled=!0,await E.collection("cashflow_categories").add({name:r,type:a,active:!0,createdAt:new Date,createdBy:y.currentUser.uid}),l[a].push(r),l[a].sort(),S(a),A();var i="INCOME"===a?"in-category":"EXPENSE"===a?"ex-category":"sav-category",s=document.getElementById(i);s&&(s.value=r),n.style.display="none",e.value=""}catch(e){console.error(e),Swal.fire("Error","No se pudo guardar la categoría.","error")}finally{o.innerHTML=c,o.disabled=!1}}t.classList.contains("btn-manage-categories")&&(await N(P=t.dataset.type),R.show())}});let R=new bootstrap.Modal(document.getElementById("modal-manage-categories")),P="INCOME";async function N(n){let a=document.querySelector("#table-manage-categories tbody");a.innerHTML="<tr><td>Cargando...</td></tr>";var e=document.querySelector("#modal-manage-categories .modal-title");let t="Ingresos";"EXPENSE"===n?t="Gastos":"SAVING"===n&&(t="Ahorros"),e&&(e.textContent=`Gestionar Categorías (${t})`);try{var r=await E.collection("cashflow_categories").where("type","==",n).get();a.innerHTML="";let t=[];r.forEach(e=>{t.push({id:e.id,...e.data()})}),t.sort((e,t)=>{e=e.createdAt?e.createdAt.toDate?e.createdAt.toDate():new Date(e.createdAt):new Date(0);return(t.createdAt?t.createdAt.toDate?t.createdAt.toDate():new Date(t.createdAt):new Date(0))-e}),t.forEach(e=>{!1!==e.active&&(a.innerHTML+=`
                    <tr>
                        <td class="align-middle">${e.name}</td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-soft-danger" onclick="softDeleteCategory('${e.id}', '${e.name}', '${n}')">
                                <i class="mdi mdi-trash-can-outline"></i>
                            </button>
                        </td>
                    </tr>
                 `)}),""===a.innerHTML&&(a.innerHTML='<tr><td colspan="2" class="text-center text-muted">No hay categorías personalizadas para este tipo.</td></tr>')}catch(e){console.error(e),a.innerHTML="<tr><td>Error al cargar.</td></tr>"}}window.softDeleteCategory=async function(e,t,n){confirm(`¿Eliminar "${t}" del selector?`)&&(await E.collection("cashflow_categories").doc(e).update({active:!1}),l[n]=l[n].filter(e=>e!==t),S(n),N(n))};document.getElementById("form-transaction");var e=document.getElementById("btn-new-income"),n=document.getElementById("btn-new-expense"),a=document.getElementById("btn-new-saving"),o=document.getElementById("btn-transfer-saving"),e=(e&&e.addEventListener("click",()=>c("INCOME")),n&&n.addEventListener("click",()=>c("EXPENSE")),a&&a.addEventListener("click",()=>c("SAVING")),o&&o.addEventListener("click",async function(){let n=document.getElementById("trans-source"),t=document.getElementById("trans-dest"),e=document.getElementById("trans-amount"),a=(n.innerHTML='<option value="">Seleccione origen...</option>',t.innerHTML='<option value="">Seleccione destino...</option>',e.value="",g.filter(e=>"SAVING"===e.type&&"USED"!==e.status));0===a.length?Swal.fire("Atención","No tienes ahorros activos para transferir.","info"):(a.forEach(e=>{var t=w(e.amount,e.currency);n.innerHTML+=`<option value="${e.id}" data-currency="${e.currency}" data-amount="${e.amount}">${e.entityName} (${t})</option>`}),a.forEach(e=>{t.innerHTML+=`<option value="TRANS_TO_SAV_${e.id}">${e.entityName} (Existente)</option>`}),l.SAVING.forEach(e=>{t.innerHTML+=`<option value="TRANS_TO_CAT_${e}">Nueva meta: ${e}</option>`}),transferModal.show())}),document.getElementById("form-transfer-saving")),n=(e&&e.addEventListener("submit",async function(t){t.preventDefault();let n=document.getElementById("trans-source").value,a=document.getElementById("trans-dest").value,r=parseFloat(document.getElementById("trans-amount").value),e=document.getElementById("btn-do-transfer");if(n&&a&&r){t=g.find(e=>e.id===n);if(r>t.amount)Swal.fire("Monto excedido","No puedes transferir más del saldo disponible en el origen.","error");else{e.disabled=!0,e.innerHTML='<i class="bx bx-loader bx-spin"></i>';try{var o=E.batch(),c=firebase.firestore.Timestamp.fromDate(new Date),i=E.collection("transactions").doc(),s=(o.set(i,{type:"SAVING",entityName:"Reducción por Transferencia: "+t.entityName,category:t.category,amount:-r,currency:t.currency,date:c,isInitial:!0,status:"ACTIVE",address:"Transferencia interna hacia: "+(a.includes("SAV_")?"otra meta":a.split("CAT_")[1]),createdAt:new Date,createdBy:y.currentUser.uid}),E.collection("transactions").doc());let e="",n="";if(a.startsWith("TRANS_TO_SAV_")){let t=a.replace("TRANS_TO_SAV_","");var l=g.find(e=>e.id===t);e=l.entityName,n=l.category}else e=a.replace("TRANS_TO_CAT_",""),n=e;o.set(s,{type:"SAVING",entityName:"Recibo por Transferencia: "+e,category:n,amount:r,currency:t.currency,date:c,isInitial:!0,status:"ACTIVE",address:"Transferencia interna desde: "+t.entityName,createdAt:new Date,createdBy:y.currentUser.uid}),await o.commit(),m.hide(),Swal.fire("Transferencia Exitosa","Monto reasignado correctamente.","success"),x()}catch(e){console.error(e),Swal.fire("Error","Error al procesar: "+e.message,"error")}finally{e.disabled=!1,e.textContent="Confirmar Transferencia"}}}}),document.getElementById("trans-source"));function c(e,t=null){"INCOME"===e?(document.getElementById("form-income").reset(),document.getElementById("in-id").value="",document.getElementById("in-date").valueAsDate=new Date,v.show()):"EXPENSE"===e?(document.getElementById("form-expense").reset(),document.getElementById("ex-id").value="",document.getElementById("ex-date").valueAsDate=new Date,p.show()):"SAVING"===e&&(document.getElementById("form-saving").reset(),document.getElementById("sav-id").value="",document.getElementById("sav-date").valueAsDate=new Date,t&&(document.getElementById("sav-id").value=t.id||"",document.getElementById("sav-name").value=t.entityName||"",document.getElementById("sav-amount").value=t.amount||0,document.getElementById("sav-target-amount").value=t.targetAmount||"",document.getElementById("sav-currency").value=t.currency||"ARS",document.getElementById("sav-category").value=t.category||"Fondo de Reserva",document.getElementById("sav-status").value=t.status||"ACTIVE",document.getElementById("sav-is-initial").checked=t.isInitial||!1,document.getElementById("sav-recurring").checked=t.isRecurring||!1,t.isRecurring&&(document.getElementById("container-sav-installments").style.display="block",document.getElementById("sav-installments").value=t.installmentsTotal||""),t.date&&(document.getElementById("sav-date").valueAsDate=B(t.date)),document.getElementById("sav-address").value=t.address||""),r.show())}async function i(e,t){e.preventDefault();var n="INCOME"===t?"in":"ex",e=e.target.querySelector('button[type="submit"]'),a=e.innerHTML;e.disabled=!0,e.innerHTML='<i class="bx bx-loader bx-spin"></i> Guardando...';try{var r=document.getElementById(n+"-id").value,o=document.getElementById(n+"-entity-name").value,c=o,i=t;if(c){var s="INCOME"===i?"CLIENT":"PROVIDER",l=i;if(!I[l].some(e=>e.toLowerCase()===c.toLowerCase()))try{await E.collection("cashflow_entities").add({name:c,type:s,createdAt:new Date,uid:h()}),I[l].push(c);var d,u="INCOME"===i?"list-entities-income":"list-entities-expense",m=document.getElementById(u);m&&((d=document.createElement("option")).value=c,m.appendChild(d)),console.log(`New entity ${c} saved as ${s}.`)}catch(e){console.error("Error auto-saving entity",e)}}await 0;var g={type:t,entityName:o,cuit:document.getElementById(n+"-cuit").value,address:document.getElementById(n+"-address").value,category:document.getElementById(n+"-category").value,status:document.getElementById(n+"-status").value,currency:document.getElementById(n+"-currency").value,accountId:document.getElementById(n+"-account").value,amount:parseFloat(document.getElementById(n+"-amount").value)||0,date:firebase.firestore.Timestamp.fromDate(document.getElementById(n+"-date").valueAsDate||new Date),isRecurring:document.getElementById(n+"-recurring").checked,installmentsTotal:parseInt(document.getElementById(n+"-installments").value)||null,installmentNumber:1,updatedAt:new Date};r?await E.collection("transactions").doc(r).update(g):(g.createdAt=new Date,g.createdBy=y.currentUser.uid,await E.collection("transactions").add(g)),("INCOME"===t?v:p).hide(),Swal.fire({toast:!0,position:"top-end",icon:"success",title:"Guardado correctamente.",showConfirmButton:!1,timer:3e3})}catch(e){console.error(e),Swal.fire("Error","No se pudo guardar el movimiento: "+e.message,"error")}finally{e.disabled=!1,e.innerHTML=a}}function x(){E.collection("transactions").where("createdBy","==",h()).onSnapshot(e=>{g=[],e.forEach(e=>g.push({id:e.id,...e.data()})),(async a=>{if(!t&&!d){t=!0;try{var r=a.filter(e=>e.isRecurring&&!e.parentRecurringId);let n=new Date;var o=new Date(n.getFullYear(),n.getMonth(),1);let e=0;for(let t of r){var c,i,s,l=B(t.date);o<=l||a.find(e=>e.parentRecurringId===t.id&&B(e.date).getMonth()===n.getMonth()&&B(e.date).getFullYear()===n.getFullYear())||(c=a.filter(e=>e.parentRecurringId===t.id).length,t.installmentsTotal&&c+1>=t.installmentsTotal)||(i=new Date(n.getFullYear(),n.getMonth(),1),delete(s={...t}).id,delete s.createdAt,s.isRecurring=!1,s.parentRecurringId=t.id,s.status="SAVING"===t.type?"ACTIVE":"PENDING",s.date=i,s.createdAt=new Date,s.description=`${t.address||""} (Recurrente Mes ${n.getMonth()+1})`,t.installmentsTotal&&(s.installmentNumber=c+2),"SAVING"===t.type&&(s.isInitial=!1),console.log("Generating recurring tx for",t.entityName,t.installmentsTotal?`(Cuota ${s.installmentNumber}/${t.installmentsTotal})`:""),await E.collection("transactions").add(s),e++)}0<e&&console.log(`Generated ${e} recurring transactions.`),d=!0}catch(e){console.error("Error in checkRecurrences:",e)}finally{t=!1}}})(g),M()})}n&&n.addEventListener("change",function(){var e=document.getElementById("trans-source"),e=e.options[e.selectedIndex],t=document.getElementById("trans-currency");e&&e.dataset.currency?t.value=e.dataset.currency:t.value=""}),document.getElementById("form-income").addEventListener("submit",e=>i(e,"INCOME")),document.getElementById("form-expense").addEventListener("submit",e=>i(e,"EXPENSE")),document.getElementById("form-saving").addEventListener("submit",async function(e){e.preventDefault(),e.target;var t=(e=document.getElementById("btn-save-saving")).innerHTML;e.disabled=!0,e.innerHTML='<i class="bx bx-loader bx-spin"></i> Guardando...';try{var n=document.getElementById("sav-id").value,a={type:"SAVING",entityName:document.getElementById("sav-name").value,category:document.getElementById("sav-category").value,status:document.getElementById("sav-status").value,currency:document.getElementById("sav-currency").value,accountId:document.getElementById("sav-account").value,amount:parseFloat(document.getElementById("sav-amount").value)||0,targetAmount:parseFloat(document.getElementById("sav-target-amount").value)||0,isInitial:document.getElementById("sav-is-initial").checked,isRecurring:document.getElementById("sav-recurring").checked,date:firebase.firestore.Timestamp.fromDate(document.getElementById("sav-date").valueAsDate||new Date),address:document.getElementById("sav-address").value,installmentsTotal:parseInt(document.getElementById("sav-installments").value)||null,installmentNumber:1,updatedAt:new Date};n?await E.collection("transactions").doc(n).update(a):(a.createdAt=new Date,a.createdBy=y.currentUser.uid,await E.collection("transactions").add(a)),r.hide(),Swal.fire({toast:!0,position:"top-end",icon:"success",title:"Ahorro guardado.",showConfirmButton:!1,timer:3e3})}catch(e){console.error(e),Swal.fire("Error","No se pudo guardar el ahorro.","error")}finally{e.disabled=!1,e.innerHTML=t}});let D=document.getElementById("filter-year"),T=document.getElementById("filter-period"),V=document.getElementById("filter-search"),G=document.getElementById("filter-category"),U=document.getElementById("filter-only-recurring");a=document.getElementById("btn-apply-filters"),o=new Date;let s=o.getFullYear();e=(o.getMonth()+1).toString().padStart(2,"0");function M(){let e=[...g];var o=parseInt(D.value);let n=T.value,t=V.value.toLowerCase(),a=G.value;if(U.checked)e=e.filter(e=>(!0===e.isRecurring||"true"===e.isRecurring)&&!e.parentRecurringId);else{let t=parseInt(D.value||(new Date).getFullYear());if(e=e.filter(e=>{e=B(e.date);return e&&e.getFullYear()===t}),"YTD"===n){let t=new Date;e=e.filter(e=>B(e.date)<=t)}else"ALL"!==n&&(e=e.filter(e=>{e=B(e.date).getMonth()+1;return"Q1"===n?1<=e&&e<=3:"Q2"===n?4<=e&&e<=6:"Q3"===n?7<=e&&e<=9:"Q4"===n?10<=e&&e<=12:"S1"===n?1<=e&&e<=6:"S2"===n?7<=e&&e<=12:e===parseInt(n)}))}"ALL"!==a&&(e=e.filter(e=>e.category===a));var c=(e,r)=>e.sort((e,t)=>{let n=e[r.column],a=t[r.column];return"date"===r.column&&(n=B(e.date).getTime(),a=B(t.date).getTime()),"string"==typeof n&&(n=n.toLowerCase()),"string"==typeof a&&(a=a.toLowerCase()),n<a?"asc"===r.direction?-1:1:n>a?"asc"===r.direction?1:-1:0}),i=c((e=t?e.filter(e=>e.entityName.toLowerCase().includes(t)||e.address&&e.address.toLowerCase().includes(t)):e).filter(e=>"INCOME"===e.type),u.INCOME),s=c(e.filter(e=>"EXPENSE"===e.type),u.EXPENSE),c=c(e.filter(e=>"SAVING"===e.type),u.SAVING);((e,t,n)=>{var a=(e,n)=>e.reduce((e,t)=>t.currency===n?e+(Number(t.amount)||0):e,0),r=e.filter(e=>"INCOME"===e.type),e=e.filter(e=>"EXPENSE"===e.type);C("kpi-income-expected-ars",a(r,"ARS")),C("kpi-income-expected-usd",a(r,"USD")),C("kpi-income-pending-ars",a(r.filter(e=>"PAID"!==e.status),"ARS")),C("kpi-income-pending-usd",a(r.filter(e=>"PAID"!==e.status),"USD")),C("kpi-expense-expected-ars",a(e,"ARS")),C("kpi-expense-expected-usd",a(e,"USD")),C("kpi-expense-pending-ars",a(e.filter(e=>"PAID"!==e.status),"ARS")),C("kpi-expense-pending-usd",a(e.filter(e=>"PAID"!==e.status),"USD"));let o=[...g],c=new Date;"ALL"!==n&&("YTD"===n?c=new Date:(s=parseInt(n),isNaN(s)?(i={Q1:3,Q2:6,Q3:9,Q4:12,S1:6,S2:12})[n]&&(c=new Date(t,i[n],0,23,59,59)):c=new Date(t,s,0,23,59,59)));var i=(o="ALL"!==n?o.filter(e=>B(e.date)<=c):o).filter(e=>"INCOME"===e.type&&"PAID"===e.status),t=o.filter(e=>"EXPENSE"===e.type&&"PAID"===e.status),s=o.filter(e=>"SAVING"===e.type),n=s.filter(e=>"USED"!==e.status),l=s.filter(e=>!0!==e.isInitial),d=f.filter(e=>"ARS"===e.currency&&!1!==e.isActive).reduce((e,t)=>e+(Number(t.initialBalance)||0),0),u=f.filter(e=>"USD"===e.currency&&!1!==e.isActive).reduce((e,t)=>e+(Number(t.initialBalance)||0),0),d=d+a(i,"ARS")-a(t,"ARS")-a(l,"ARS"),u=u+a(i,"USD")-a(t,"USD")-a(l,"USD"),t=a(n,"ARS"),l=a(n,"USD"),l=(C("kpi-balance-ars",d),C("kpi-balance-usd",u),C("kpi-savings-ars",t),C("kpi-savings-usd",l),C("kpi-total-ars",d+t),C("kpi-total-usd",u+l),Q(),n=a(r.filter(e=>"PAID"===e.status),"ARS")-a(e.filter(e=>"PAID"===e.status),"ARS"),t=a(r.filter(e=>"PAID"===e.status),"USD")-a(e.filter(e=>"PAID"===e.status),"USD"),n),r=t,a=d,e=u,n=document.getElementById("surplus-assistant-container"),t=document.getElementById("surplus-msg"),d=document.getElementById("filter-period").value;if(100<l||0<r){a=Math.min(l,a),e=Math.min(r,e);if(a<=0&&e<=0)return n.style.display="none";a={"01":"Enero","02":"Febrero","03":"Marzo","04":"Abril","05":"Mayo","06":"Junio","07":"Julio","08":"Agosto","09":"Septiembre",10:"Octubre",11:"Noviembre",12:"Diciembre"}[d];if(a)return n.style.display="block",t.innerHTML=`Ganaste <strong>${w(l,"ARS")}</strong> / <strong>${w(r,"USD")}</strong> netos en <strong>${a}</strong>. ¿Deseas ahorrar una parte?`}n.style.display="none"})(e,o,n);{o=[...i,...s,...c];let t=document.querySelector("#table-income tbody"),n=document.querySelector("#table-expense tbody"),a=document.querySelector("#table-saving tbody"),r=(t.innerHTML="",n.innerHTML="",a.innerHTML="",(e,t=!1)=>{var n=B(e.date),n=n?n.toLocaleDateString():"N/A",a=w(e.amount||0,e.currency||"ARS");let r="badge bg-warning text-dark",o="Pendiente";return"PAID"===e.status&&(r="badge bg-success",o="Cobrado/Pagado"),"USED"===e.status&&(r="badge bg-secondary",o="Usado"),t?`
                    <tr>
                        <td>${n}</td>
                        <td>
                            <h6 class="mb-0 font-size-14 text-truncate">${e.entityName}</h6>
                            ${e.installmentsTotal?`<div class="mt-1"><span class="badge badge-soft-info" style="border: 1px solid #0ab39c;">Cuota ${e.installmentNumber||1}/${e.installmentsTotal}</span></div>`:""}
                        </td>
                        <td><span class="badge badge-soft-primary">${e.category}</span></td>
                        <td><span class="text-truncate d-block" style="max-width: 150px;">${e.address||"-"}</span></td>
                        <td>${"ARS"===e.currency?a:"-"}</td>
                        <td>${"USD"===e.currency?a:"-"}</td>
                        <td>${!0===e.isRecurring||"true"===e.isRecurring?'<i class="bx bx-revision text-primary" title="Recurrente"></i>':""}</td>
                        <td><div class="${r}">${o}</div></td>
                        <td>
                            <div class="d-flex gap-2 text-end justify-content-end">
                                <button class="btn btn-sm btn-soft-primary" onclick="editSaving('${e.id}')" title="Editar"><i class="mdi mdi-pencil"></i></button>
                                ${"USED"!==e.status?`<button class="btn btn-sm btn-info" onclick="useSavingForExpense('${e.id}')" title="Usar para Gasto"><i class="mdi mdi-arrow-right-bold-circle-outline"></i></button>`:""}
                                <button class="btn btn-sm btn-soft-danger" onclick="deleteTransaction('${e.id}')"><i class="mdi mdi-trash-can"></i></button>
                            </div>
                        </td>
                    </tr>
                 `:(t="PENDING"===e.status?`<button class="btn btn-sm btn-soft-success" onclick="toggleStatus('${e.id}', 'PAID')" title="Marcar como Completado"><i class="bx bx-check"></i></button>`:`<button class="btn btn-sm btn-soft-warning" onclick="toggleStatus('${e.id}', 'PENDING')" title="Marcar Pendiente"><i class="bx bx-undo"></i></button>`,`
                <tr>
                    <td>${n}</td>
                    <td>
                        <h6 class="mb-0 font-size-14 text-truncate">${e.entityName}</h6>
                        <small class="text-muted text-truncate">
                            ${e.cuit||"-"} 
                            ${e.installmentsTotal?` <span class="badge badge-soft-info ms-1" style="border: 1px solid #0ab39c;">Cuota ${e.installmentNumber||1}/${e.installmentsTotal}</span>`:""}
                        </small>
                    </td>
                    <td><span class="badge badge-soft-primary">${e.category}</span></td>
                    <td>${e.address||"-"}</td>
                    <td>${"ARS"===e.currency?a:"-"}</td>
                    <td>${"USD"===e.currency?a:"-"}</td>
                    <td>${!0===e.isRecurring||"true"===e.isRecurring?'<i class="bx bx-revision text-primary"></i>':"-"}</td>
                    <td><div class="${r}">${o}</div></td>
                    <td>
                        <div class="d-flex gap-2">
                            ${t}
                            <button class="btn btn-sm btn-soft-danger" onclick="deleteTransaction('${e.id}')"><i class="mdi mdi-trash-can"></i></button>
                        </div>
                    </td>
                </tr>
            `)});o.filter(e=>"INCOME"===e.type).forEach(e=>{t.innerHTML+=r(e,!1)}),o.filter(e=>"EXPENSE"===e.type).forEach(e=>{n.innerHTML+=r(e,!1)}),o.filter(e=>"SAVING"===e.type).forEach(e=>{a.innerHTML+=r(e,!0)})}_(),F()}[...D.options].some(e=>e.value==s)||((n=document.createElement("option")).value=s,n.textContent=s,D.appendChild(n)),D.value=s,T.value=e,a.addEventListener("click",M),[D,T,G,U].forEach(e=>e.addEventListener("change",M)),["table-income","table-expense","table-saving"].forEach(c=>{var e=document.getElementById(c);e&&e.querySelectorAll("th[data-sort]").forEach(o=>{o.style.cursor="pointer",o.addEventListener("click",()=>{var e=c.split("-")[1].toUpperCase(),t=o.dataset.sort,n=(u[e].column===t?u[e].direction="asc"===u[e].direction?"desc":"asc":(u[e].column=t,u[e].direction="asc"),c),a=t,r=u[e].direction;(n=(n=document.getElementById(n)).querySelectorAll("th[data-sort]")).forEach(e=>{var t;e.querySelectorAll(".sort-icon").forEach(e=>e.remove()),e.dataset.sort===a&&((t=document.createElement("i")).className=`mdi mdi-arrow-${"asc"===r?"up":"down"} ms-1 sort-icon`,e.appendChild(t))}),M()})})});{let t=(o=new Date).getFullYear();o=(o.getMonth()+1).toString().padStart(2,"0"),n=document.getElementById("filter-year"),e=document.getElementById("filter-period"),n&&e&&([...n.options].some(e=>e.value==t)||((a=document.createElement("option")).value=t,a.textContent=t,n.appendChild(a)),n.value=t,e.value=o)}function F(){let r=document.querySelector("#table-agreements tbody"),s=(r.innerHTML="",document.getElementById("filter-period").value),l=document.getElementById("filter-year").value;let o=!!{"01":"Enero","02":"Febrero","03":"Marzo","04":"Abril","05":"Mayo","06":"Junio","07":"Julio","08":"Agosto","09":"Septiembre",10:"Octubre",11:"Noviembre",12:"Diciembre"}[s];0===b.length?r.innerHTML='<tr><td colspan="7" class="text-center text-muted">No hay acuerdos registrados.</td></tr>':b.forEach(i=>{var e=w(i.amount,i.currency);let t="";if(o){var n=l+"-"+s,a=i.invoices&&i.invoices[n]&&i.invoices[n].sent;t=`
                    <div class="form-check form-switch mb-0">
                        <input class="form-check-input" type="checkbox" id="list-invoice-${i.id}" ${a?"checked":""} onchange="toggleInvoiceSent('${i.id}', '${n}', this)">
                        <label class="form-check-label text-muted small" for="list-invoice-${i.id}">${a?i.hasInvoice?"ENVIADA":"GENERADO":i.hasInvoice?"NO ENVIADA":"PENDIENTE"}</label>
                    </div>
                `}else{let o=0,c=0;i.invoices&&Object.keys(i.invoices).forEach(t=>{var[n,a]=t.split("-");if(n===l){var r,a=parseInt(a);let e=!1;"ALL"===s?e=!0:"YTD"===s?(r=new Date,new Date(parseInt(n),a-1,1)<=r&&(e=!0)):"Q1"===s?e=1<=a&&a<=3:"Q2"===s?e=4<=a&&a<=6:"Q3"===s?e=7<=a&&a<=9:"Q4"===s?e=10<=a&&a<=12:"S1"===s?e=1<=a&&a<=6:"S2"===s&&(e=7<=a&&a<=12),e&&i.invoices[t].sent&&(c++,o+=i.amount)}}),t=0<c?`<span class="badge bg-success-subtle text-success font-size-12 p-2">${c} Gen. (${w(o,i.currency)})</span>`:'<span class="text-muted small">-</span>'}r.innerHTML+=`
                <tr>
                    <td>
                        <h6 class="mb-0 text-truncate font-size-14">${i.name}</h6>
                        <small class="text-muted d-block d-lg-none">${i.description||"-"}</small>
                    </td>
                    <td class="d-none d-lg-table-cell">
                        <small class="d-block text-muted">${i.description||"-"}</small>
                        <small class="d-block code">${i.cuit||""}</small>
                    </td>
                    <td class="fw-bold">${e}</td>
                    <td>${i.hasInvoice?i.biller||"-":'<span class="text-muted font-size-11 fst-italic">No Factura</span>'}</td>
                    <td>${t}</td>
                    <td>
                        <button class="btn btn-sm btn-soft-primary" onclick="editAgreement('${i.id}')"><i class="mdi mdi-pencil"></i></button>
                    </td>
                </tr>
            `})}function _(){let o=document.getElementById("monthly-control-list");o.innerHTML="";var e=document.getElementById("filter-period").value,t=document.getElementById("filter-year").value,n={"01":"Enero","02":"Febrero","03":"Marzo","04":"Abril","05":"Mayo","06":"Junio","07":"Julio","08":"Agosto","09":"Septiembre",10:"Octubre",11:"Noviembre",12:"Diciembre"};let c="",a="";a=n[e]?(c=t+"-"+e,n[e]+" "+t):(t=((e=new Date).getMonth()+1).toString().padStart(2,"0"),c=e.getFullYear()+"-"+t,`${n[t]} ${e.getFullYear()} (Actual)`);n=b.filter(e=>"MONTHLY"===e.frequency);0===n.length?o.innerHTML='<tr><td colspan="6" class="text-center text-muted">No hay acuerdos mensuales activos.</td></tr>':(document.querySelector("#card-monthly-control .card-title").innerHTML='<i class="mdi mdi-playlist-check me-1"></i> Control de Facturación: '+a,n.forEach(e=>{var t=w(e.amount,e.currency);let n=!1;e.invoices&&e.invoices[c]&&e.invoices[c].sent&&(n=!0);var a=`
                <div class="form-check form-switch mb-0">
                    <input class="form-check-input" type="checkbox" id="ctrl-invoice-${e.id}" ${n?"checked":""} onchange="toggleInvoiceSent('${e.id}', '${c}', this)">
                    <label class="form-check-label text-muted small" for="ctrl-invoice-${e.id}">${n?"GENERADO":"PENDIENTE"}</label>
                </div>
             `,r=e.hasInvoice?'<span class="badge bg-success-subtle text-success">Sí</span>':'<span class="badge bg-secondary-subtle text-secondary">No</span>';o.innerHTML+=`
                <tr class="${n?"bg-success-subtle":""}">
                    <td><strong>${e.name}</strong></td>
                    <td><small class="text-muted coding">${e.cuit||"-"}</small></td>
                    <td>${r}</td>
                    <td class="fw-bold">${t}</td>
                    <td>${e.biller||"-"}</td>
                    <td>${a}</td>
                </tr>
             `}))}function C(e,t){document.getElementById(e).textContent=new Intl.NumberFormat("es-AR").format(t)}window.openCapitalizeModal=async function(){var e=parseFloat(document.getElementById("kpi-balance-ars").textContent.replace(/[$.]/g,"").replace(",","."))||0,t=parseFloat(document.getElementById("kpi-balance-usd").textContent.replace(/[$.]/g,"").replace(",","."))||0,n=document.getElementById("filter-period").value,a=document.getElementById("filter-year").value,r={"01":"Enero","02":"Febrero","03":"Marzo","04":"Abril","05":"Mayo","06":"Junio","07":"Julio","08":"Agosto","09":"Septiembre",10:"Octubre",11:"Noviembre",12:"Diciembre"}[n],e=(await Swal.fire({title:"Capitalizar Excedente - "+r,html:`
                <div class="text-start">
                    <p class="text-muted small">Decide cuánto mover del saldo disponible actual a tus ahorros.</p>
                    <div class="mb-3">
                        <label class="form-label">Monto en Pesos (ARS) - Disponible: ${w(e,"ARS")}</label>
                        <input id="swal-ars" class="form-control" type="number" step="0.01" value="${0<e?e:0}">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Monto en Dólares (USD) - Disponible: ${w(t,"USD")}</label>
                        <input id="swal-usd" class="form-control" type="number" step="0.01" value="${0<t?t:0}">
                    </div>
                </div>
            `,focusConfirm:!1,showCancelButton:!0,confirmButtonText:"Confirmar Ahorro",cancelButtonText:"Cancelar",preConfirm:()=>({ars:parseFloat(document.getElementById("swal-ars").value)||0,usd:parseFloat(document.getElementById("swal-usd").value)||0})})).value;e&&(async(e,t,a,r)=>{let o=new Date(a,parseInt(t),0),c=E.batch(),i=E.collection("transactions"),s=0,n=(e,t)=>{var n;e<=0||(n=i.doc(),c.set(n,{type:"SAVING",entityName:`Capitalización Excedente ${r} `+a,category:"Fondo de Reserva",status:"ACTIVE",currency:t,amount:e,date:firebase.firestore.Timestamp.fromDate(o),address:`Traspaso de saldo sobrante del periodo filtrado (${r} ${a}).`,createdAt:new Date,createdBy:y.currentUser.uid}),s++)};if(n(e.ars,"ARS"),n(e.usd,"USD"),0<s)try{await c.commit(),Swal.fire("¡Éxito!","Excedente capitalizado correctamente.","success")}catch(e){console.error(e),Swal.fire("Error","No se pudo realizar el traspaso.","error")}})(e,n,a,r)},window.toggleStatus=function(e,t){E.collection("transactions").doc(e).update({status:t})},window.deleteTransaction=async function(e){if((await Swal.fire({title:"¿Eliminar?",text:"No podrás revertir esto.",icon:"warning",showCancelButton:!0,confirmButtonColor:"#f46a6a",confirmButtonText:"Sí, eliminar",cancelButtonText:"Cancelar"})).isConfirmed)try{await E.collection("transactions").doc(e).delete(),Swal.fire({toast:!0,position:"top-end",icon:"success",title:"Eliminado correctamente.",showConfirmButton:!1,timer:2e3})}catch(e){console.error("Error al eliminar:",e),Swal.fire("Error","No se pudo eliminar: "+e.message,"error")}},window.editSaving=function(t){var e=g.find(e=>e.id===t);e&&c("SAVING",e)},window.convertSaving=async function(t){var e=g.find(e=>e.id===t);if(e){e=(await Swal.fire({title:"Mover a Gasto",text:"Ingresa el nombre del Proveedor/Entidad para este gasto:",input:"text",inputValue:e.entityName,showCancelButton:!0,confirmButtonText:"Convertir"})).value;if(e)try{await E.collection("transactions").doc(t).update({type:"EXPENSE",entityName:e,status:"PAID"}),Swal.fire("Éxito","Ahorro convertido en gasto correctamente.","success")}catch(e){console.error(e),Swal.fire("Error",e.message,"error")}}},window.useSavingForExpense=window.convertSaving;let L=new bootstrap.Modal(document.getElementById("agreement-modal")),X=document.getElementById("form-agreement");async function q(){E.collection("cashflow_agreements").where("isActive","!=",!1).onSnapshot(e=>{b=[],e.forEach(e=>b.push({id:e.id,...e.data()})),F(),_(),(async()=>{O||console.log("Automatic agreement processing is disabled (Manual Mode).")})()})}y.currentUser&&q(),document.getElementById("btn-new-agreement").addEventListener("click",()=>{X.reset(),document.getElementById("agreement-id").value="",document.getElementById("agreement-modal-title").textContent="Nuevo Acuerdo",document.getElementById("btn-delete-agreement").classList.add("d-none"),document.getElementById("agr-last-update").textContent=(new Date).toISOString().split("T")[0],document.getElementById("agr-biller").value="Lucre",document.getElementById("div-biller").style.display="block",document.getElementById("agr-currency").value="ARS",document.getElementById("agr-frequency").value="MONTHLY",document.getElementById("agr-account").value="",document.getElementById("agr-hasInvoice").value="true",L.show()}),document.getElementById("agr-hasInvoice").addEventListener("change",e=>{var t=document.getElementById("div-biller"),n=document.getElementById("agr-biller");"true"===e.target.value?(t.style.display="block",n.value="Lucre"):(t.style.display="none",n.value="")}),window.editAgreement=function(t){var e=b.find(e=>e.id===t);e&&(document.getElementById("agreement-id").value=t,document.getElementById("agreement-modal-title").textContent="Editar Acuerdo",document.getElementById("agr-name").value=e.name,document.getElementById("agr-cuit").value=e.cuit||"",document.getElementById("agr-hasInvoice").value=e.hasInvoice?"true":"false",e.hasInvoice?(document.getElementById("div-biller").style.display="block",document.getElementById("agr-biller").value=e.biller||"Lucre"):(document.getElementById("div-biller").style.display="none",document.getElementById("agr-biller").value=""),document.getElementById("agr-desc").value=e.description||"",document.getElementById("agr-frequency").value=e.frequency||"MONTHLY",document.getElementById("agr-currency").value=e.currency||"ARS",document.getElementById("agr-account").value=e.accountId||"",document.getElementById("agr-amount").value=e.amount,document.getElementById("agr-last-update").textContent=e.lastUpdate||"-",document.getElementById("btn-delete-agreement").classList.remove("d-none"),L.show())},X.addEventListener("submit",async e=>{e.preventDefault();var e=document.getElementById("agreement-id").value,t=document.getElementById("btn-save-agreement");t.disabled=!0,t.innerHTML='<i class="bx bx-loader bx-spin"></i>';try{var n={name:document.getElementById("agr-name").value,cuit:document.getElementById("agr-cuit").value,hasInvoice:"true"===document.getElementById("agr-hasInvoice").value,biller:document.getElementById("agr-biller").value,description:document.getElementById("agr-desc").value,frequency:document.getElementById("agr-frequency").value,currency:document.getElementById("agr-currency").value,accountId:document.getElementById("agr-account").value,amount:parseFloat(document.getElementById("agr-amount").value)||0,lastUpdate:document.getElementById("agr-last-update").textContent,isActive:!0,updatedAt:new Date};e?await E.collection("cashflow_agreements").doc(e).update(n):(n.createdAt=new Date,n.uid=h(),n.invoices={},await E.collection("cashflow_agreements").add(n)),L.hide(),Swal.fire("Guardado","El acuerdo se actualizó correctamente.","success")}catch(e){console.error(e),Swal.fire("Error","No se pudo guardar: "+e.message,"error")}finally{t.disabled=!1,t.textContent="Guardar Acuerdo"}}),document.getElementById("btn-delete-agreement").addEventListener("click",async()=>{let t=document.getElementById("agreement-id").value;t&&Swal.fire({title:"¿Archivar Acuerdo?",text:"No aparecerá en los listados activos.",icon:"warning",showCancelButton:!0,confirmButtonText:"Sí, archivar",cancelButtonText:"Cancelar"}).then(async e=>{e.isConfirmed&&(await E.collection("cashflow_agreements").doc(t).update({isActive:!1}),L.hide())})}),document.getElementById("btn-calc-update").addEventListener("click",()=>{let e=document.getElementById("agr-amount");var t=document.getElementById("agr-calc-percent"),n=document.getElementById("agr-last-update"),a=parseFloat(e.value)||0,r=parseFloat(t.value)||0;0!==r&&(e.value=(a+a*(r/100)).toFixed(2),n.textContent=(new Date).toISOString().split("T")[0],e.classList.add("is-valid"),setTimeout(()=>e.classList.remove("is-valid"),2e3),t.value="")}),window.toggleInvoiceSent = async function(agreementId, periodKey, toggleElement) {
    const isChecked = toggleElement.checked;
    const agreement = b.find(a => a.id === agreementId);

    if (!agreement) {
        console.error("Acuerdo no encontrado");
        return;
    }

    try {
        const agreementRef = E.collection("cashflow_agreements").doc(agreementId);

        if (isChecked) {
            let finalCurrency = agreement.currency;
            let finalAmount = agreement.amount;
            let descriptionSuffix = "";
            const altCurrency = agreement.currency === "USD" ? "ARS" : "USD";

            const result = await Swal.fire({
                title: "Moneda de Cobro",
                text: `El acuerdo es de ${w(agreement.amount, agreement.currency)}. ¿En qué moneda se cobró?`,
                icon: "question",
                showDenyButton: true,
                showCancelButton: true,
                confirmButtonText: `Cobrar en ${agreement.currency}`,
                denyButtonText: `Convertir a ${altCurrency}`,
                cancelButtonText: "Cancelar"
            });

            if (result.isDismissed) {
                toggleElement.checked = false;
                return;
            }

            if (result.isDenied) {
                const { value: rate } = await Swal.fire({
                    title: "Tipo de Cambio",
                    text: `Ingrese la cotización para convertir de ${agreement.currency} a ${altCurrency}:`,
                    input: "number",
                    inputAttributes: { min: 0, step: 0.01 },
                    showCancelButton: true,
                    confirmButtonText: "Aplicar Conversión",
                    inputValidator: (value) => {
                        if (!value || value <= 0) return "Ingrese un valor válido mayor a 0";
                    }
                });

                if (!rate) {
                    toggleElement.checked = false;
                    return;
                }

                const conversionRate = parseFloat(rate);
                finalCurrency = altCurrency;
                
                if (agreement.currency === "USD" && finalCurrency === "ARS") {
                    finalAmount = agreement.amount * conversionRate;
                    descriptionSuffix = ` [Conv. de USD a tasa ${conversionRate}]`;
                } else {
                    finalAmount = agreement.amount / conversionRate;
                    descriptionSuffix = ` [Conv. de ARS a tasa ${conversionRate}]`;
                }
            }
            
            const newIncome = {
                type: "INCOME",
                entityName: agreement.name + descriptionSuffix,
                cuit: agreement.cuit,
                address: "Facturación Mensual Automática",
                category: "Honorarios",
                status: "PAID",
                currency: finalCurrency,
                accountId: agreement.accountId || null,
                amount: finalAmount,
                date: firebase.firestore.Timestamp.fromDate(new Date()),
                isRecurring: false,
                agreementId: agreementId,
                periodKey: periodKey,
                createdAt: new Date(),
                createdBy: h()
            };

            const docRef = await E.collection("transactions").add(newIncome);

            const updateData = {};
            updateData[`invoices.${periodKey}`] = {
                sent: true,
                date: new Date().toISOString().split('T')[0],
                incomeId: docRef.id
            };
            
            await agreementRef.update(updateData);

            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Ingreso generado y Factura marcada.',
                showConfirmButton: false,
                timer: 3000
            });

        } else {
            const invoiceData = agreement.invoices ? agreement.invoices[periodKey] : null;
            
            if (invoiceData && invoiceData.incomeId) {
                const confirmUndo = await Swal.fire({
                    title: "¿Deshacer cobro?",
                    text: "Esto eliminará el ingreso asociado a esta factura. ¿Estás seguro?",
                    icon: "warning",
                    showCancelButton: true,
                    confirmButtonText: "Sí, eliminar ingreso",
                    cancelButtonText: "No, mantener"
                });

                if (!confirmUndo.isConfirmed) {
                    toggleElement.checked = true;
                    return;
                }

                await E.collection("transactions").doc(invoiceData.incomeId).delete();
            }

            const updateData = {};
            updateData[`invoices.${periodKey}`] = firebase.firestore.FieldValue.delete();
            
            await agreementRef.update(updateData);
            
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'info',
                title: 'Factura desmarcada.',
                showConfirmButton: false,
                timer: 2000
            });
        }

    } catch (error) {
        console.error(error);
        toggleElement.checked = !isChecked;
        Swal.fire("Error", "Ocurrió un error al procesar la solicitud: " + error.message, "error");
    }
};let z=new bootstrap.Modal(document.getElementById("modal-manage-accounts")),Y=document.getElementById("form-account");function Q(){var e=document.getElementById("account-summary-container");let a=document.getElementById("account-summary-list");f&&0!==f.length?(e.style.display="block",a.innerHTML="",f.filter(e=>!1!==e.isActive).forEach(e=>{var t=$(e.id),n=document.createElement("tr");n.innerHTML=`
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar-xs me-2">
                            <span class="avatar-title rounded-circle bg-soft-primary text-primary font-size-10">
                                <i class="mdi mdi-bank"></i>
                            </span>
                        </div>
                        <div>
                            <h5 class="font-size-13 mb-0">${e.name}</h5>
                            <small class="text-muted">${e.currency}</small>
                        </div>
                    </div>
                </td>
                <td class="text-end">
                    <h5 class="font-size-14 mb-0 ${t<0?"text-danger":"text-success"}">${w(t,e.currency)}</h5>
                    <small class="text-muted">Disponible</small>
                </td>
            `,a.appendChild(n)})):e.style.display="none"}function $(t){var e=f.find(e=>e.id===t);return e?(Number(e.initialBalance)||0)+(e=g.filter(e=>e.accountId===t&&"PAID"===e.status)).filter(e=>"INCOME"===e.type).reduce((e,t)=>e+(Number(t.amount)||0),0)-e.filter(e=>"EXPENSE"===e.type).reduce((e,t)=>e+(Number(t.amount)||0),0)-g.filter(e=>e.accountId===t&&"SAVING"===e.type&&"ACTIVE"===e.status&&!0!==e.isInitial).reduce((e,t)=>e+(Number(t.amount)||0),0):0}document.getElementById("btn-config-accounts").addEventListener("click",()=>z.show()),Y.addEventListener("submit",async function(e){e.preventDefault();var e=document.getElementById("acc-id").value,t=document.getElementById("btn-save-account"),n=t.innerHTML,a={name:document.getElementById("acc-name").value,currency:document.getElementById("acc-currency").value,initialBalance:parseFloat(document.getElementById("acc-initial-balance").value)||0,updatedAt:new Date,isActive:!0};try{if(!y.currentUser)throw new Error("Usuario no autenticado");t.disabled=!0,t.innerHTML='<i class="bx bx-loader bx-spin"></i>',e?await E.collection("cashflow_accounts").doc(e).update(a):(a.uid=h(),a.createdAt=new Date,await E.collection("cashflow_accounts").add(a)),Y.reset(),document.getElementById("acc-id").value="",document.getElementById("title-account-form").textContent="Agregar Nueva Cuenta",Swal.fire({toast:!0,position:"top-end",icon:"success",title:"Cuenta guardada.",showConfirmButton:!1,timer:2e3})}catch(e){console.error(e),Swal.fire("Error","No se pudo guardar la cuenta.","error")}finally{t.disabled=!1,t.innerHTML=n}});let k=document.getElementById("acc-trans-source"),H=document.getElementById("acc-source-balance-info"),J=(k&&k.addEventListener("change",()=>{let t=k.value;var e,n;t?(e=f.find(e=>e.id===t))&&(n=$(t),H.innerHTML=`<i class="mdi mdi-information-outline me-1"></i> Disponible: <span class="text-primary fw-bold">${w(n,e.currency)}</span>`):H.innerHTML=""}),document.getElementById("btn-transfer-saving").addEventListener("click",()=>{H&&(H.innerHTML=""),m.show()}),document.getElementById("form-account-transfer"));J.addEventListener("submit",async e=>{e.preventDefault();let t=document.getElementById("acc-trans-source").value,n=document.getElementById("acc-trans-dest").value;var a=parseFloat(document.getElementById("acc-trans-amount").value),r=document.getElementById("acc-trans-date").valueAsDate||new Date;if(t===n)Swal.fire("Error","La cuenta origen y destino no pueden ser la misma.","warning");else{var o=f.find(e=>e.id===t),c=f.find(e=>e.id===n);if(o&&c){var i=$(t);if(i<a)Swal.fire("Saldo Insuficiente",`La cuenta ${o.name} solo dispone de ${w(i,o.currency)}.`,"warning");else{i=e.target.querySelector('button[type="submit"]'),e=i.innerHTML;try{if(!y.currentUser)throw new Error("Usuario no autenticado");i.disabled=!0,i.innerHTML='<i class="bx bx-loader bx-spin"></i> Procesando...';var s="TRANS_"+Date.now(),l={type:"EXPENSE",entityName:"Transf. a "+c.name,category:"Transferencia Enviada",status:"PAID",currency:o.currency,accountId:t,amount:a,date:firebase.firestore.Timestamp.fromDate(r),transferId:s,createdAt:new Date,createdBy:h(),description:"Transferencia entre cuentas propias"},d={type:"INCOME",entityName:"Transf. de "+o.name,category:"Transferencia Recibida",status:"PAID",currency:c.currency,accountId:n,amount:a,date:firebase.firestore.Timestamp.fromDate(r),transferId:s,createdAt:new Date,createdBy:h(),description:"Transferencia entre cuentas propias"},u=E.batch();u.set(E.collection("transactions").doc(),l),u.set(E.collection("transactions").doc(),d),await u.commit(),m.hide(),J.reset(),Swal.fire("Éxito","Transferencia realizada correctamente.","success")}catch(e){console.error(e),Swal.fire("Error","No se pudo realizar la transferencia.","error")}finally{i.disabled=!1,i.innerHTML=e}}}}})});