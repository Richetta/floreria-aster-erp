const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('src/pages/Orders/Orders.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Kanban Card Redesign: White text, better contrast, Delivery Icon
const cardOld = /<div \s*key=\{order\.id\}[\s\S]*?<div className="mt-auto pt-4 border-t border-white\/20 flex justify-between items-center">[\s\S]*?<\/div>[\s\S]*?<\/div>\s*?\)\}/g;

// We need a precise replace for the card content. I'll search for the card render inside columnOrders.map
const mapStart = /\{columnOrders\.map\(order => \([\s\S]*?className=\{`order-card mb-6 p-6 status-\$\{order\.status\}/;
const mapBodyRegex = /\{columnOrders\.map\(order => \(\s*<div\s*key=\{order\.id\}\s*id=\{`order-card-\$\{order\.id\}`\}\s*className=\{`order-card mb-6 p-6 status-\$\{order\.status\} \$\{draggedOrderId === order\.id \? 'opacity-50' : ''\}`\}\s*onClick=\{[^}]+\}\s*draggable="true"\s*onDragStart=\{[^}]+\}\s*onDragEnd=\{[^}]+\}\s*>[\s\S]*?<\/div>\s*\)\)}/;

const newCardCode = `{columnOrders.map(order => (
                                    <div 
                                        key={order.id} 
                                        id={\`order-card-\${order.id}\`}
                                        className={\`order-card mb-6 p-6 status-\${order.status} \${draggedOrderId === order.id ? 'opacity-50' : ''}\`}
                                        onClick={() => setSelectedOrder(order)}
                                        draggable="true"
                                        onDragStart={(e) => handleDragStart(e, order.id)}
                                        onDragEnd={() => handleDragEnd(order.id)}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <span className="text-micro font-black bg-white/20 px-3 py-1 rounded-full text-white tracking-widest uppercase shadow-sm">ID: {order.id.replace('o', '')}</span>
                                            <div className="p-1.5 bg-white/20 rounded-lg shadow-sm">
                                                {order.deliveryMethod === 'delivery' ? <Truck size={16} className="text-white" /> : <MapPin size={16} className="text-white" />}
                                            </div>
                                        </div>

                                        <h4 className="font-extrabold text-h4 leading-tight mb-4 tracking-tight text-white drop-shadow-sm">{order.customerName}</h4>
                                        
                                        <div className="space-y-3 mb-4 bg-white/10 p-3 rounded-xl border border-white/20 shadow-sm">
                                            <div className="flex items-center gap-2 text-white font-bold text-small">
                                                <CalendarDays size={14} className="text-white" />
                                                <span>{timeFilter === 'hoy' ? 'Hoy' : new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(new Date(order.date))}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-white text-small">
                                                <Clock size={14} className="text-white" />
                                                <span className="font-bold">{new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(order.date))} hs</span>
                                            </div>
                                        </div>

                                        <div className="mt-auto pt-4 border-t border-white/30 flex justify-between items-center">
                                            <span className="text-small text-white uppercase font-black tracking-tighter">TOTAL</span>
                                            <p className="font-black text-xl text-white drop-shadow-md">\\$\${order.total.toLocaleString()}</p>
                                        </div>
                                    </div>
                                ))}`;

content = content.replace(mapBodyRegex, newCardCode);

// 2. Exact Modal replace for the dark typography, better padding, and delivery method info
const modalRegex = /\{selectedOrder! && \([\s\S]*?className="modal-content[\s\S]*?<\/div>\s*?<\/div>\s*?<\/div>\s*?\)\}/;

const newModalCode = `{selectedOrder! && (
                <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
                    <div className="modal-content max-w-ui !p-0 overflow-hidden" onClick={e => e.stopPropagation()}>
                        
                        {/* Header Banner */}
                        <header className={\`px-10 py-8 flex justify-between items-center status-\${selectedOrder!.status} text-white shadow-lg\`}>
                            <div className="flex items-center gap-5">
                                <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md shadow-inner">
                                    <FileText size={28} className="text-white"/> 
                                </div>
                                <div>
                                    <h2 className="text-h1 text-white leading-none mb-2 font-black tracking-tight drop-shadow-sm">Pedido #\${selectedOrder!.id.replace('o', '')}</h2>
                                    <span className="text-h4 text-white font-black px-4 py-1.5 bg-white/20 rounded-full inline-block shadow-sm">
                                        {columns.find(c => c.id === selectedOrder!.status)?.label}
                                    </span>
                                </div>
                            </div>
                            <button className="p-3 bg-white/10 rounded-full hover:bg-white/30 transition-colors shadow-sm" onClick={() => setSelectedOrder(null)}>
                                <X size={32} className="text-white" />
                            </button>
                        </header>
                        
                        <div className="modal-body p-10 space-y-12 bg-background overflow-y-auto max-h-[85vh]">
                            
                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
                                
                                {/* Inner Left: Logistics & Customer */}
                                <div className="xl:col-span-7 space-y-10">
                                    <section>
                                        <h3 className="modal-section-title text-black"><UserCircle size={20} className="text-primary" /> INFORMACIÓN DEL CLIENTE</h3>
                                        <div className="detail-card rounded-3xl p-8 bg-white shadow-sm">
                                            <div className="flex items-center gap-6">
                                                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-h3 shadow-inner">
                                                    {selectedOrder!.customerName.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-soft-label uppercase tracking-widest mb-1">Nombre Completo</p>
                                                    <p className="text-h3 font-black text-high-contrast">{selectedOrder!.customerName}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    <section>
                                        <h3 className="modal-section-title text-black"><CalendarSearch size={20} className="text-primary"/> PLANIFICACIÓN DE ENTREGA</h3>
                                        <div className="detail-card rounded-3xl grid grid-cols-2 gap-8 p-8 bg-white shadow-sm">
                                            <div className="col-span-2 md:col-span-1 border-b md:border-b-0 md:border-r border-border pb-6 md:pb-0 md:pr-6">
                                                <p className="text-soft-label uppercase tracking-widest mb-2">Día Programado</p>
                                                <div className="flex items-center gap-3 text-high-contrast font-black text-h4">
                                                    <CalendarDays size={24} className="text-primary"/>
                                                    <span>{new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(selectedOrder!.date))}</span>
                                                </div>
                                            </div>
                                            <div className="col-span-2 md:col-span-1 border-b md:border-b-0 md:border-r border-border pb-6 md:pb-0 md:pr-6">
                                                <p className="text-soft-label uppercase tracking-widest mb-2">Franja Horaria</p>
                                                <div className="flex items-center gap-3 text-high-contrast font-black text-h4">
                                                    <Clock size={24} className="text-primary"/>
                                                    <span>{new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(selectedOrder!.date))} hs</span>
                                                </div>
                                            </div>
                                            
                                            {/* Delivery Method Info */}
                                            <div className="col-span-2 bg-surface-hover p-4 rounded-xl border border-border flex items-center justify-center gap-4 mt-2">
                                                {selectedOrder!.deliveryMethod === 'delivery' ? (
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-3 bg-primary/10 rounded-full text-primary"><Truck size={24}/></div>
                                                        <div>
                                                            <p className="text-soft-label uppercase tracking-widest leading-none mb-1">Tipo de Entrega</p>
                                                            <p className="text-h4 font-black text-high-contrast">Envío a Domicilio</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-3 bg-success/10 rounded-full text-success"><MapPin size={24}/></div>
                                                        <div>
                                                            <p className="text-soft-label uppercase tracking-widest leading-none mb-1">Tipo de Entrega</p>
                                                            <p className="text-h4 font-black text-high-contrast">Retira por Local</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </section>
                                </div>

                                {/* Inner Right: Payments & Notes */}
                                <div className="xl:col-span-5 space-y-10">
                                    <section>
                                        <h3 className="modal-section-title text-black"><Banknote size={20} className="text-primary"/> RESUMEN FINANCIERO</h3>
                                        <div className="finance-card p-8 rounded-3xl space-y-6 bg-white shadow-md border-2 border-border">
                                            <div className="flex justify-between items-end border-b border-border pb-6">
                                                <div>
                                                    <p className="text-soft-label uppercase tracking-widest mb-1">TOTAL A COBRAR</p>
                                                    <p className="text-h1 text-success font-black tracking-tighter">\\$\${selectedOrder!.total.toLocaleString()}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-soft-label uppercase tracking-widest mb-1">Seña Dejada</p>
                                                    <p className="font-black text-h3 text-high-contrast">\\$\${(selectedOrder!.advancePayment || 0).toLocaleString()}</p>
                                                </div>
                                            </div>
                                            
                                            <div className="pt-2">
                                                {selectedOrder!.total - (selectedOrder!.advancePayment || 0) > 0 ? (
                                                    <div className="bg-danger/10 p-6 rounded-2xl border-2 border-danger/20 flex justify-between items-center shadow-inner">
                                                        <p className="text-danger font-black uppercase tracking-widest text-small">SALDO PENDIENTE</p>
                                                        <p className="text-h2 text-danger font-black">\\$\${(selectedOrder!.total - (selectedOrder!.advancePayment || 0)).toLocaleString()}</p>
                                                    </div>
                                                ) : (
                                                    <div className="bg-success/10 p-6 rounded-2xl border-2 border-success/30 text-center shadow-inner">
                                                        <p className="text-success font-black uppercase text-h4 tracking-widest">✨ ¡PAGADO TOTALMENTE! ✨</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </section>

                                    <section className="h-full">
                                        <h3 className="modal-section-title text-black"><AlertCircle size={20} className="text-warning-dark"/> NOTAS E INSTRUCCIONES</h3>
                                        <div className="bg-warning/5 p-6 rounded-3xl border-2 border-warning/20 h-[180px] overflow-y-auto shadow-inner">
                                            {selectedOrder!.notes ? (
                                                <p className="text-h4 text-high-contrast italic leading-relaxed font-bold opacity-90">{selectedOrder!.notes}</p>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full text-muted opacity-50">
                                                    <AlertCircle size={32} className="mb-2" />
                                                    <p className="text-small font-bold uppercase tracking-widest">Sin observaciones especiales.</p>
                                                </div>
                                            )}
                                        </div>
                                    </section>
                                </div>
                            </div>

                            {/* Status Timeline */}
                            <section className="status-timeline-container rounded-3xl shadow-sm border border-border mt-8">
                                <p className="text-soft-label uppercase tracking-widest text-center mb-10 font-black text-black">PROGRESIÓN DEL PEDIDO</p>
                                <div className="flex items-center w-full relative px-6">
                                    <div className="absolute top-1/2 left-0 w-full h-2 bg-border -translate-y-1/2 z-0 rounded-full"></div>
                                    
                                    <div className="relative z-10 flex flex-row w-full justify-between items-center gap-4">
                                        {columns.map((col) => {
                                            const statuses = columns.map(c => c.id);
                                            const currentIndex = statuses.indexOf(selectedOrder!.status);
                                            const thisIndex = statuses.indexOf(col.id);
                                            const isPast = thisIndex < currentIndex;
                                            const isCurrent = thisIndex === currentIndex;
                                            
                                            let btnClass = "bg-white border-2 border-border text-black opacity-60 hover:opacity-100 shadow-md hover:shadow-lg";
                                            if (isCurrent) btnClass = \`status-\${col.id} text-white border-transparent shadow-2xl scale-110 ring-4 ring-white\`;
                                            else if (isPast) btnClass = "bg-black border-black text-white shadow-md";

                                            return (
                                                <div key={col.id} className="flex-1 flex flex-col items-center gap-4">
                                                    <button 
                                                        className={\`btn h-14 px-4 min-w-[100px] w-full max-w-[160px] rounded-2xl text-small font-black transition-all \${btnClass} flex items-center justify-center py-2\`}
                                                        onClick={() => handleStatusMove(selectedOrder!.id, selectedOrder!.status, col.id)}
                                                    >
                                                        {isCurrent ? <CheckCircle2 size={20} className="text-white mr-2"/> : null}
                                                        {col.label.toUpperCase()}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </section>

                        </div>
                    </div>
                </div>
            )}`;

content = content.replace(modalRegex, newModalCode);

fs.writeFileSync(targetFile, content);
console.log('Orders.tsx Phase 4 script executed successfully.');
