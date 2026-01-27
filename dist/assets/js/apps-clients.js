let clients=[],currentFilter="ALL",currentView="GRID";function openWhatsApp(e){e&&(e=e.replace(/[^0-9]/g,""),/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)?window.open("https://wa.me/"+e,"_blank"):window.open("https://web.whatsapp.com/send?phone="+e,"whatsapp_window"))}async function loadClients(){db.collection("clients").onSnapshot(e=>{clients=[],e.forEach(e=>{clients.push({id:e.id,...e.data()})}),updateTotalCount(),renderCurrentView(),populateOfficeSelect()})}function toggleView(e){currentView=e,renderCurrentView()}function renderCurrentView(){var e=document.getElementById("clients-grid"),t=document.getElementById("clients-list");("GRID"===currentView?(e.classList.remove("d-none"),t.classList.add("d-none"),renderClientsGrid):(e.classList.add("d-none"),t.classList.remove("d-none"),renderClientsList))()}function filterClients(e){currentFilter=e,document.querySelectorAll(".nav-link").forEach(e=>e.classList.remove("active")),"ALL"===e&&document.getElementById("tab-all").classList.add("active"),"CLIENT"===e&&document.getElementById("tab-clients").classList.add("active"),"OFFICE"===e&&document.getElementById("tab-offices").classList.add("active"),renderCurrentView()}function updateTotalCount(){document.getElementById("total-clients-count").textContent=`(${clients.length})`}function renderClientsGrid(){let o=document.getElementById("clients-grid"),e=(o.innerHTML="",clients);0===(e="ALL"!==currentFilter?clients.filter(e=>e.type===currentFilter):e).length?o.innerHTML=`
            <div class="col-12 text-center mt-5">
                <div class="avatar-xl mx-auto mb-4">
                    <div class="avatar-title bg-light rounded-circle text-primary display-4">
                        <i class="bx bx-user-x"></i>
                    </div>
                </div>
                <h5 class="text-muted">No se encontraron registros.</h5>
            </div>
        `:e.forEach(e=>{var t="OFFICE"===e.type,n=e.officeName||(e.parentId?getOfficeName(e.parentId):"Independiente"),i=e.email?"mailto:"+e.email:"#",a="apps-clients-profile.html?id="+e.id;let l="";l=t?`
                <div class="avatar-xl mx-auto mb-4">
                    <div class="avatar-title bg-primary-subtle text-primary display-4 m-0 rounded-circle">
                         <i class="bx bxs-building-house"></i>
                    </div>
                </div>
             `:`
                <div class="avatar-xl mx-auto mb-4">
                    <div class="avatar-title bg-light-subtle text-primary display-4 m-0 rounded-circle">
                        ${e.name?e.name.substring(0,2).toUpperCase():"??"}
                    </div>
                </div>
             `;var d=e.phone?`<button onclick="openWhatsApp('${e.phone}')" class="btn btn-outline-light text-truncate" data-bs-toggle="tooltip" title="WhatsApp"><i class="mdi mdi-whatsapp font-size-18 text-success"></i></button>`:'<button class="btn btn-outline-light text-truncate disabled"><i class="mdi mdi-whatsapp font-size-18 text-muted"></i></button>',i=e.email?`<a href="${i}" class="btn btn-outline-light text-truncate" data-bs-toggle="tooltip" title="Email"><i class="mdi mdi-email-outline font-size-18 text-danger"></i></a>`:'<button class="btn btn-outline-light text-truncate disabled"><i class="mdi mdi-email-outline font-size-18 text-muted"></i></button>',s=`<a href="${a}" class="btn btn-outline-light text-truncate w-100"><i class="uil uil-user me-1"></i> Ver Bitácora / Perfil</a>`;o.innerHTML+=`
            <div class="col-xl-3 col-sm-6">
                <div class="card text-center border shadow-none">
                    <div class="card-body">
                         <div class="dropdown text-end">
                            <a class="text-muted dropdown-toggle font-size-16" href="#" role="button" data-bs-toggle="dropdown" aria-haspopup="true">
                              <i class="bx bx-dots-horizontal-rounded"></i>
                            </a>
                            <div class="dropdown-menu dropdown-menu-end">
                                <a class="dropdown-item" href="#" onclick="editClient('${e.id}')">Editar</a>
                                <div class="dropdown-divider"></div>
                                <a class="dropdown-item text-danger" href="#" onclick="deleteClient('${e.id}')">Eliminar</a>
                            </div>
                        </div>

                        ${l}
                        
                        <h5 class="font-size-16 mb-1"><a href="${a}" class="text-body">${e.name}</a></h5>
                        <p class="text-muted mb-2">${t?'<span class="badge bg-primary">OFICINA</span>':'<span class="badge bg-success">CLIENTE</span>'}</p>
                        
                        ${t?'<div class="mb-3">&nbsp;</div>':`<small class="text-muted d-block mb-3">Oficina: <strong>${n}</strong></small>`}
                        
                         <div class="d-flex justify-content-center gap-2 mb-3">
                            ${d}
                            ${i}
                        </div>
                    </div>
                    <div class="btn-group border-top" role="group">
                        ${s}
                    </div>
                </div>
            </div>
        `})}function renderClientsList(){let l=document.getElementById("clients-table-body"),e=(l.innerHTML="",clients);0===(e="ALL"!==currentFilter?clients.filter(e=>e.type===currentFilter):e).length?l.innerHTML='<tr><td colspan="4" class="text-center text-muted">No se encontraron registros.</td></tr>':e.forEach(e=>{var t="OFFICE"===e.type,n=e.officeName||(e.parentId?getOfficeName(e.parentId):"Independiente"),i="apps-clients-profile.html?id="+e.id,t=t?'<span class="badge bg-primary">OFICINA</span>':`<span class="badge bg-success">CLIENTE</span><br><small class="text-muted">${n}</small>`;let a="";e.email&&(a+=`<div><i class="mdi mdi-email me-1"></i> ${e.email}</div>`),e.phone&&(a+=`<div><a href="#" onclick="openWhatsApp('${e.phone}')" class="text-body"><i class="mdi mdi-whatsapp me-1 text-success"></i> ${e.phone}</a></div>`),a=a||'<span class="text-muted">-</span>',l.innerHTML+=`
            <tr>
                <td>
                    <h5 class="font-size-14 mb-1"><a href="${i}" class="text-dark">${e.name}</a></h5>
                </td>
                <td>${t}</td>
                <td>${a}</td>
                <td>
                    <div class="dropdown">
                        <button class="btn btn-link font-size-16 shadow-none py-0 text-muted dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                            <i class="bx bx-dots-horizontal-rounded"></i>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><a class="dropdown-item" href="${i}">Ver Perfil / Bitácora</a></li>
                            <li><a class="dropdown-item" href="#" onclick="editClient('${e.id}')">Editar</a></li>
                            <li><a class="dropdown-item text-danger" href="#" onclick="deleteClient('${e.id}')">Eliminar</a></li>
                        </ul>
                    </div>
                </td>
            </tr>
         `})}function getOfficeName(t){var e=clients.find(e=>e.id===t);return e?e.name:"Desconocida"}function populateOfficeSelect(){let t=document.getElementById("client-office");t.innerHTML='<option value="">- Ninguna / Independiente -</option>',clients.filter(e=>"OFFICE"===e.type).forEach(e=>{t.innerHTML+=`<option value="${e.id}">${e.name}</option>`})}function toggleClientFields(){var e=document.querySelector('input[name="clientType"]:checked').value,t=document.getElementById("personal-fields");"OFFICE"===e?t.classList.add("d-none"):t.classList.remove("d-none")}async function saveClient(){var e=document.getElementById("client-id").value,t=document.getElementById("client-name").value,n=document.querySelector('input[name="clientType"]:checked').value,i=document.getElementById("client-desc").value;if(t){i={name:t,type:n,description:i,updatedAt:new Date};"CLIENT"===n&&(i.email=document.getElementById("client-email").value,i.phone=document.getElementById("client-phone").value,i.birthDate=document.getElementById("client-bday").value,i.parentId=document.getElementById("client-office").value||null);try{e?(await db.collection("clients").doc(e).update(i),"CLIENT"===n&&checkAndCreateBirthdayTask(e,t,i.birthDate)):(i.createdAt=new Date,a=await db.collection("clients").add(i),"CLIENT"===n&&checkAndCreateBirthdayTask(a.id,t,i.birthDate)),document.getElementById("form-client").reset(),document.getElementById("client-id").value="";var a,l=document.getElementById("newClientModal");bootstrap.Modal.getInstance(l).hide(),Swal.fire({icon:"success",title:"Guardado",timer:1500,showConfirmButton:!1})}catch(e){console.error(e),alert("Error al guardar: "+e.message)}}else alert("El nombre es obligatorio")}async function checkAndCreateBirthdayTask(e,t,n){var i;n&&e&&(i=new Date,n=n.split("-"),(n=new Date(i.getFullYear(),parseInt(n[1])-1,parseInt(n[2])))<i&&n.setFullYear(i.getFullYear()+1),i=n.toISOString().split("T")[0],(await db.collection("tasks").where("clientId","==",e).where("type","==","BIRTHDAY").get()).empty)&&(await db.collection("tasks").add({title:"🎂 Cumpleaños de "+t,description:"Saludar por su cumpleaños.",dueDate:i,clientId:e,clientName:t,type:"BIRTHDAY",recurrence:"YEARLY",priority:"HIGH",status:"TODO",category:"General",createdAt:new Date,assignedTo:"Ambos"}),console.log("Birthday Task Created for",t))}function editClient(t){var e=clients.find(e=>e.id===t);e&&(document.getElementById("client-id").value=e.id,document.getElementById("client-name").value=e.name,document.getElementById("client-desc").value=e.description||"","OFFICE"===e.type?document.getElementById("type-office").checked=!0:(document.getElementById("type-client").checked=!0,document.getElementById("client-email").value=e.email||"",document.getElementById("client-phone").value=e.phone||"",document.getElementById("client-bday").value=e.birthDate||"",document.getElementById("client-office").value=e.parentId||""),toggleClientFields(),new bootstrap.Modal(document.getElementById("newClientModal")).show())}async function deleteClient(e){confirm("¿Estás seguro de eliminar este registro?")&&await db.collection("clients").doc(e).delete()}document.addEventListener("DOMContentLoaded",function(){window.Imala.auth.checkAuth(e=>{console.log("Auth User:",e),loadClients()})});