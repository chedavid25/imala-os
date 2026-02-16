window.togglePrivacy=function(){var t=document.querySelectorAll(".privacy-blur"),e=document.getElementById("privacy-icon");let a="blur(8px)"===t[0]?.style.filter||!t[0]?.style.filter;t.forEach(t=>{a?t.style.filter="none":t.style.filter="blur(8px)"}),e&&(a?e.className="mdi mdi-eye-off":e.className="mdi mdi-eye"),localStorage.setItem("privacyMode",a?"off":"on")},document.addEventListener("DOMContentLoaded",function(){let o=window.Imala.auth,d=window.Imala.db,s=document.getElementById("dashboard-user-name"),i=document.getElementById("dashboard-user-role");document.getElementById("dashboard-user-avatar");o.onAuthStateChanged(n=>{n&&d.collection("users").doc(n.uid).get().then(t=>{var e=t.exists?t.data():{},e=(t.exists&&(t=e.displayName||"Usuario",s&&(s.textContent=t),i&&(i.textContent=e.role||"Rol"),e=document.querySelector(".mob-user-name"))&&(e.textContent=t),new Date),t=document.getElementById("mob-month-name"),a=document.getElementById("mob-day-number");t&&(t.textContent=["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"][e.getMonth()]),a&&(a.textContent=e.getDate()),n.uid,d.collection("tasks").onSnapshot(m=>{let u=[];m.forEach(t=>{"settings_categories"!==t.id&&(t={id:t.id,...t.data()},u.push(t))}),l=u,r();{m=u;let t=new Date,e=t.getFullYear(),a=String(t.getMonth()+1).padStart(2,"0"),n=String(t.getDate()).padStart(2,"0"),s=e+`-${a}-`+n,o=t=>{var e;return t.dueDate&&t.dueDate.seconds?`${(e=new Date(1e3*t.dueDate.seconds)).getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-`+String(e.getDate()).padStart(2,"0"):t.dueDate&&"string"==typeof t.dueDate?t.dueDate.split("T")[0]:"9999-99-99"},i=m.filter(t=>"COMPLETED"!==t.status&&o(t)===s).length,d=m.filter(t=>"COMPLETED"!==t.status&&(o(t)<s||"LATE"===t.status)).length,l=m.filter(t=>"COMPLETED"===t.status).length,r=document.getElementById("kpi-tasks-pending"),c=document.getElementById("kpi-tasks-late-badge");document.getElementById("stat-pending")&&(document.getElementById("stat-pending").textContent=i),document.getElementById("stat-late")&&(document.getElementById("stat-late").textContent=d),document.getElementById("stat-completed")&&(document.getElementById("stat-completed").textContent=l),r&&(r.textContent=i),c&&(c.textContent=d+" Atrasadas",c.classList.remove("d-none"));var m=document.getElementById("mob-kpi-tasks"),g=document.getElementById("mob-kpi-late");m&&(m.textContent=i),g&&(g.textContent=d+" Atrasadas",g.style.display=0<d?"inline-block":"none")}{m=u;let a=document.getElementById("dashboard-tasks-list");if(a){a.innerHTML="";var g=new Date,t=g.getFullYear(),s=String(g.getMonth()+1).padStart(2,"0"),g=String(g.getDate()).padStart(2,"0");let n=t+`-${s}-`+g;t=m.filter(t=>{var e,a;return"COMPLETED"!==t.status&&(e=(a=t).dueDate&&a.dueDate.seconds?`${(e=new Date(1e3*a.dueDate.seconds)).getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-`+String(e.getDate()).padStart(2,"0"):"string"==typeof a.dueDate?a.dueDate.split("T")[0]:"9999-99-99",a="LATE"===t.status||e<n,t=e===n,a||t)});t.sort((t,e)=>{var a=t=>{var e;return t.dueDate&&t.dueDate.seconds?(e=new Date(1e3*t.dueDate.seconds)).getFullYear()+`-${String(e.getMonth()+1).padStart(2,"0")}-`+String(e.getDate()).padStart(2,"0"):t.dueDate?t.dueDate.split("T")[0]:"9999-99-99"},n=a(t),a=a(e),s=new Date,s=s.getFullYear()+`-${String(s.getMonth()+1).padStart(2,"0")}-`+String(s.getDate()).padStart(2,"0"),t="LATE"===t.status||n<s,e="LATE"===e.status||a<s;return t&&!e?-1:!t&&e?1:(t=a===s,(e=n===s)&&!t?-1:!e&&t?1:n.localeCompare(a))}),0===t.length?a.innerHTML='<tr><td colspan="5" class="text-center text-muted p-4">¡Todo listo! No tienes tareas pendientes.</td></tr>':t.slice(0,20).forEach((t,e)=>a.appendChild(((e,t)=>{let a="-",n=!1,s=new Date,o=s.getFullYear(),i=String(s.getMonth()+1).padStart(2,"0"),d=String(s.getDate()).padStart(2,"0"),l=`${o}-${i}-`+d,r="9999-99-99";var c;e.dueDate&&(e.dueDate.seconds?(c=new Date(1e3*e.dueDate.seconds),a=c.toLocaleDateString(),r=`${c.getFullYear()}-${String(c.getMonth()+1).padStart(2,"0")}-`+String(c.getDate()).padStart(2,"0")):"string"==typeof e.dueDate&&(c=e.dueDate.split("-"),a=3===c.length?c[2]+"/"+c[1]:e.dueDate,r=e.dueDate.split("T")[0])),r===l&&(n=!0);let m="LATE"===e.status?'<span class="badge bg-danger-subtle text-danger font-size-11">Atrasada</span>':'<span class="badge bg-warning-subtle text-warning font-size-11">Pendiente</span>',u=(n&&"LATE"!==e.status&&"COMPLETED"!==e.status&&(m='<span class="badge bg-info-subtle text-info font-size-11">HOY</span>'),'<span class="text-muted font-size-11">-</span>');if(e.assignedTo){var g=e.assignedTo,p=g.charAt(0).toUpperCase();let t="Ambos"===g?"info":"Lucre"===g?"pink":"primary";u=`
                <div class="avatar-xs" title="${g}">
                    <span class="avatar-title rounded-circle bg-${t} text-white font-size-12 d-flex align-items-center justify-content-center">
                        ${p}
                    </span>
                </div>
             `}let v="";return v="LATE"===e.status?`<button class="btn btn-sm btn-outline-danger" onclick="completeTask('${e.id}')" title="Regularizar"><i class="bx bx-check"></i></button>`:`<button class="btn btn-sm btn-outline-success" onclick="completeTask('${e.id}')" title="Completar"><i class="bx bx-check"></i></button>`,(g=document.createElement("tr")).innerHTML=`
            <td><h6 class="mb-0 font-size-13">${t}</h6></td>
            <td>
                <h6 class="text-truncate font-size-14 mb-1" style="max-width: 250px;">
                    <a href="apps-tareas.html" class="text-dark">${e.title}</a>
                </h6>
            </td>
            <td>${u}</td>
            <td>
               <div class="font-size-13"><i class="bx bx-calendar me-1 text-muted"></i> ${a}</div>
            </td>
            <td>${m}</td>
            <td>${v}</td>
        `,g})(t,e+1)))}}s=u,g=document.getElementById("dashboard-noti-list-widget");if(g){let a=[],n=(s.forEach(t=>{(t.hasUserUnread||t.userUnreadCount&&0<t.userUnreadCount)&&a.push({type:"message",title:"Mensaje Nuevo",text:"En: "+t.title,time:"Reciente",icon:"bx-chat",color:"danger"})}),Date.now()),e=(s.forEach(t=>{var e;"COMPLETED"!==t.status&&t.createdAt&&(e=t.createdAt.seconds?1e3*t.createdAt.seconds:null)&&n-e<864e5&&!t.hasUserUnread&&a.push({type:"task",title:"Nueva Tarea",text:t.title,time:"Hoy",icon:"bx-task",color:"primary"})}),0===a.length&&a.push({type:"system",title:"Sistema",text:"Bienvenido a Imalá OS v2.0",time:"Ahora",icon:"bx-info-circle",color:"info"}),"");a.slice(0,5).forEach(t=>{e+=`
                <li class="activity-list activity-border">
                    <div class="activity-icon avatar-md">
                        <span class="avatar-title bg-${t.color}-subtle text-${t.color} rounded-circle">
                            <i class="bx ${t.icon} font-size-20"></i>
                        </span>
                    </div>
                    <div class="timeline-list-item">
                        <div class="d-flex">
                            <div class="flex-grow-1 overflow-hidden me-4">
                                <h5 class="font-size-14 mb-1">${t.title}</h5>
                                <p class="text-truncate text-muted font-size-13">${t.text}</p>
                            </div>
                            <div class="flex-shrink-0 text-end">
                                <span class="font-size-11">${t.time}</span>
                            </div>
                        </div>
                    </div>
                </li>
            `}),g.innerHTML=e,(t=>{var a=document.getElementById("mob-recent-activity");if(a)if(0===t.length)a.innerHTML='<div class="text-center p-4 text-muted">No hay actividad reciente</div>';else{let e='<div class="list-group list-group-flush">';t.slice(0,5).forEach(t=>{e+=`
                <div class="list-group-item border-0 px-0 py-3">
                    <div class="d-flex align-items-center">
                        <div class="avatar-xs me-3">
                            <span class="avatar-title rounded-circle bg-${t.color} bg-opacity-10 text-${t.color}">
                                <i class="bx ${t.icon} font-size-16"></i>
                            </span>
                        </div>
                        <div class="flex-grow-1 overflow-hidden">
                            <h6 class="mb-1 font-size-14 text-truncate">${t.title}</h6>
                            <p class="mb-0 text-muted font-size-12 text-truncate">${t.text}</p>
                        </div>
                        <div class="text-end ms-2">
                            <span class="text-muted font-size-11">${t.time}</span>
                        </div>
                    </div>
                </div>
            `}),e+="</div>",a.innerHTML=e}})(a)}}),d.collection("clients").where("type","==","CLIENT").get().then(t=>{var t=t.size,e=document.getElementById("kpi-clients-count"),e=(e&&(e.textContent=t),document.getElementById("mob-kpi-clients"));e&&(e.textContent=t)}).catch(t=>console.error("Error loading clients:",t));{d.collection("accounts").onSnapshot(t=>{let e=0,a=0;t.forEach(t=>{t=t.data();"ARS"===t.currency&&(e+=t.balance||0),"USD"===t.currency&&(a+=t.balance||0)});var t=document.getElementById("mob-total-liquidity"),n=document.getElementById("mob-total-invested"),t=(t&&(t.textContent=e.toLocaleString("es-AR",{minimumFractionDigits:2})),n&&(n.textContent=a.toLocaleString("es-AR",{minimumFractionDigits:2})),document.getElementById("mob-total-balance"));t&&(t.textContent=e.toLocaleString("es-AR",{minimumFractionDigits:2}))});let o=(new Date).getMonth(),i=(new Date).getFullYear();d.collection("transactions").onSnapshot(t=>{let a=0,n=0,s=[];t.forEach(t=>{var t={id:t.id,...t.data()},e=t.date?.toDate?t.date.toDate():new Date(t.date);e.getMonth()===o&&e.getFullYear()===i&&("INCOME"===t.type&&(a+=t.amount||0),"EXPENSE"===t.type)&&(n+=t.amount||0),s.push(t)});var t=document.getElementById("mob-total-income"),e=document.getElementById("mob-total-expense");t&&(t.textContent=a.toLocaleString("es-AR",{minimumFractionDigits:2})),e&&(e.textContent=n.toLocaleString("es-AR",{minimumFractionDigits:2}));{t=s.sort((t,e)=>(e.date?.toDate?e.date.toDate():new Date(e.date))-(t.date?.toDate?t.date.toDate():new Date(t.date)));let o=document.getElementById("mob-recent-activity");o&&(o.innerHTML="",0===(t=t.slice(0,10)).length?o.innerHTML='<div class="text-center p-4 text-muted small">No hay transacciones recientes</div>':t.forEach(t=>{var e=t.date?.toDate?t.date.toDate():new Date(t.date),a="INCOME"===t.type,n=a?"success":"danger",s=a?"+":"-",e=`
                <div class="d-flex align-items-center mb-3 p-3 bg-white" style="border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                    <div class="avatar-sm me-3">
                        <span class="avatar-title rounded-circle bg-soft-${n} text-${n}">
                            <i class="bx ${a?"bx-trending-up":"bx-trending-down"} font-size-18"></i>
                        </span>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-1 fw-bold font-size-14">${t.item||"Transacción"}</h6>
                        <p class="text-muted small mb-0">${e.toLocaleDateString()} • ${t.accountName||"Cuenta"}</p>
                    </div>
                    <div class="text-end">
                        <h6 class="mb-0 fw-bold text-${n}">${s}$${(t.amount||0).toLocaleString("es-AR",{minimumFractionDigits:2})}</h6>
                        <span class="badge ${a?"bg-soft-success text-success":"bg-soft-danger text-danger"} rounded-pill font-size-10 text-uppercase">${a?"Ingreso":"Egreso"}</span>
                    </div>
                </div>
            `;o.insertAdjacentHTML("beforeend",e)}))}})}}).catch(t=>{console.error("Error loading user profile:",t)})});let e=new bootstrap.Modal(document.getElementById("new-task-modal"));window.openNewTaskModal=function(){var t=document.getElementById("task-form"),t=(t&&t.reset(),document.getElementById("task-id").value="",document.getElementById("task-modal-title").textContent="Nueva Tarea",document.getElementById("task-save-text").textContent="Crear Tarea",document.getElementById("task-more-fields")),t=(t&&t.classList.remove("show"),document.getElementById("btn-toggle-task-fields"));t&&(t.textContent="Ver más campos..."),e.show()},window.toggleTaskMoreFields=function(){var t=document.getElementById("task-more-fields"),e=document.getElementById("btn-toggle-task-fields");t&&(t.classList.contains("show")?(t.classList.remove("show"),e.textContent="Ver más campos..."):(t.classList.add("show"),e.textContent="Ver menos campos"))};let l=[];function r(){let a=new Date,n=!1;l.forEach(t=>{var e;"google"===t.source&&"COMPLETED"!==t.status&&t.dueDate&&(e=t.dueDate+(t.dueTime?"T"+t.dueTime:"T23:59:59"),new Date(e)<a)&&(d.collection("tasks").doc(t.id).update({status:"COMPLETED"}),n=!0)}),n&&Swal.mixin({toast:!0,position:"top-end",showConfirmButton:!1,timer:3e3,timerProgressBar:!0}).fire({icon:"info",title:"Tareas de Google actualizadas automáticamente"})}setInterval(r,3e5),window.completeTask=function(t){d.collection("tasks").doc(t).update({status:"COMPLETED"}).then(()=>{Swal.fire({icon:"success",title:"¡Tarea Completada!",showConfirmButton:!1,timer:1500,toast:!0,position:"top-end"})})};var a=document.getElementById("event-modal");if(a){let e=new bootstrap.Modal(a),t=document.getElementById("form-event"),n=[],s=[];function c(){d.collection("clients").where("type","==","CLIENT").get().then(t=>{n=[],t.forEach(t=>{n.push({id:t.id,...t.data()})});{let a=document.getElementById("event-client-id");a&&(a.innerHTML='<option value="">- Ninguno -</option>',n.forEach(t=>{var e=document.createElement("option");e.value=t.id,e.textContent=t.name,a.appendChild(e)}))}}),d.collection("users").get().then(t=>{s=[],t.forEach(t=>{var e=t.data();s.push({uid:t.id,name:e.displayName||"Usuario"})});{let a=document.getElementById("event-assignedTo");a&&(a.innerHTML=`
                <option value="David">David</option>
                <option value="Ambos">Ambos</option>
            `,s.forEach(t=>{var e;"David"!==t.name&&((e=document.createElement("option")).value=t.name,e.textContent=t.name,a.appendChild(e))}))}})}window.openNewTaskModal=function(){c(),t.reset(),document.getElementById("task-id").value="",document.getElementById("event-dueDate").value=(new Date).toISOString().split("T")[0],document.getElementById("event-status").value="TODO",e.show()};a=document.getElementById("task-form");a&&a.addEventListener("submit",t=>{t.preventDefault();t=document.querySelector('input[name="priority"]:checked')?.value||"LOW",t={title:document.getElementById("task-title").value,dueDate:document.getElementById("task-due-date").value,dueTime:document.getElementById("task-due-time").value,priority:t,assignedTo:document.getElementById("task-assigned-to").value,description:document.getElementById("task-desc").value,status:"PENDIENTE",createdAt:new Date,updatedAt:new Date,createdBy:o.currentUser?o.currentUser.uid:null,source:"manual"};d.collection("tasks").add(t).then(()=>{e.hide(),Swal.fire({icon:"success",title:"Tarea Creada",timer:1500,toast:!0,position:"top-end"})}).catch(t=>{console.error(t),Swal.fire("Error","No se pudo crear la tarea","error")})})}{let a=document.getElementById("mob-user-name");o.onAuthStateChanged(t=>{if(t){d.collection("users").doc(t.uid).get().then(t=>{var e;t.exists&&(e=((t=t.data()).displayName||"Usuario").split(" ")[0],a&&(a.textContent=e),e=document.getElementById("mob-user-avatar"))&&t.photoURL&&(e.src=t.photoURL)});{d.collection("accounts").onSnapshot(t=>{let e=0;t.forEach(t=>{t=t.data();"ARS"===t.currency&&(e+=t.balance||0)});t=document.getElementById("mob-home-balance");t&&(t.textContent="$ "+e.toLocaleString("es-AR",{minimumFractionDigits:0}))});let s=(new Date).getMonth(),o=(new Date).getFullYear();d.collection("transactions").onSnapshot(t=>{let a=0,n=0;t.forEach(t=>{var t=t.data(),e=t.date?.toDate?t.date.toDate():new Date(t.date);e.getMonth()===s&&e.getFullYear()===o&&("INCOME"===t.type&&(a+=t.amount||0),"EXPENSE"===t.type)&&(n+=t.amount||0)});var t=document.getElementById("mob-month-inc"),e=document.getElementById("mob-month-exp");t&&(t.textContent=`+$ ${(a/1e3).toFixed(0)}k`),e&&(e.textContent=`-$ ${(n/1e3).toFixed(0)}k`)})}d.collection("tasks").onSnapshot(t=>{var e=new Date;e.setHours(0,0,0,0);let a=e.toISOString().split("T")[0],n=[],s=[];t.forEach(t=>{"settings_categories"!==t.id&&"COMPLETED"!==(t={id:t.id,...t.data()}).status&&("LATE"===t.status||t.dueDate&&t.dueDate<a?n.push(t):t.dueDate===a&&s.push(t))});e=[...n,...s].slice(0,5),t=document.getElementById("mob-urgent-tasks-list");if(t)if(0===e.length)t.innerHTML=`
                <div class="text-center p-4 text-muted">
                    <i class="bx bx-check-circle font-size-24 d-block mb-2 opacity-50"></i>
                    <span class="font-size-12">Sin tareas urgentes</span>
                </div>
            `;else{let i="";e.forEach(t=>{var e="LATE"===t.status,a=e?"danger":"warning",n=e?"bx-error-circle":"bx-time",s=e?"danger":"warning",o=t.dueTime?" • "+t.dueTime:"";i+=`
                <div class="list-group-item border-0 border-start border-4 border-${a} py-3">
                    <div class="d-flex align-items-start">
                        <div class="avatar-xs me-3 mt-1">
                            <span class="avatar-title rounded-circle bg-soft-${s} text-${s} font-size-16">
                                <i class="bx ${n}"></i>
                            </span>
                        </div>
                        <div class="flex-grow-1">
                            <h6 class="font-size-13 mb-1 text-dark">${t.title}</h6>
                            <p class="mb-0 text-muted font-size-11">
                                <i class="bx bx-calendar me-1"></i>${t.dueDate||"Sin fecha"}${o}
                                ${t.assignedTo?`<span class="ms-2"><i class="bx bx-user me-1"></i>${t.assignedTo}</span>`:""}
                            </p>
                        </div>
                        <div class="text-end ms-2">
                            <span class="badge bg-${a}-subtle text-${a} font-size-10">
                                ${e?"ATRASADA":"HOY"}
                            </span>
                        </div>
                    </div>
                </div>
            `}),t.innerHTML=i}}),d.collection("transactions").onSnapshot(t=>{let e=[];t.forEach(t=>{t={id:t.id,...t.data()};e.push(t)}),e.sort((t,e)=>{t=t.date?.toDate?t.date.toDate():new Date(t.date);return(e.date?.toDate?e.date.toDate():new Date(e.date))-t});var t=e.slice(0,3),a=document.getElementById("mob-recent-transactions");if(a)if(0===t.length)a.innerHTML=`
                <div class="text-center p-4 text-muted">
                    <i class="bx bx-receipt font-size-24 d-block mb-2 opacity-50"></i>
                    <span class="font-size-12">Sin movimientos recientes</span>
                </div>
            `;else{let i="";t.forEach(t=>{var e=t.date?.toDate?t.date.toDate():new Date(t.date),a="INCOME"===t.type,n=a?"bx-trending-up":"bx-cart",s=a?"success":"danger",a=a?"+":"-",o=e.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"}),e=e.toLocaleDateString("es-AR",{day:"2-digit",month:"short"});i+=`
                <div class="list-group-item border-0 d-flex align-items-center py-3">
                    <div class="avatar-xs me-3">
                        <span class="avatar-title rounded-circle bg-soft-${s} text-${s} font-size-16">
                            <i class="bx ${n}"></i>
                        </span>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="font-size-13 mb-0 text-truncate">${t.item||"Transacción"}</h6>
                        <small class="text-muted">${e}, ${o}</small>
                    </div>
                    <div class="text-end">
                        <h6 class="font-size-13 mb-0 text-${s}">${a}$ ${(t.amount||0).toLocaleString("es-AR",{minimumFractionDigits:0})}</h6>
                    </div>
                </div>
            `}),a.innerHTML=i}})}})}});