const fs = require('fs');
let code = fs.readFileSync('src/pages/Orders/Orders.tsx', 'utf8');

code = code.replace('className="flex flex-col md:flex-row gap-6"', 'className="flex flex-row gap-6"');
code = code.replace('hidden md:block', 'block');
code = code.replace('flex flex-col md:flex-row w-full justify-between gap-3 md:gap-0', 'flex flex-row w-full justify-between gap-1 sm:gap-0 flex-wrap sm:flex-nowrap');
code = code.replace('min-w-[120px]', 'w-full sm:min-w-[100px] flex-1');
code = code.replace('<LayoutGrid size={16} /> Kanban', '<LayoutGrid size={16} className="mr-1"/> Kanban');
code = code.replace('<CalendarDays size={16} /> Calendario', '<CalendarDays size={16} className="mr-1"/> Calendario');

fs.writeFileSync('src/pages/Orders/Orders.tsx', code);
console.log('Fixed modal layout in Orders.tsx');
