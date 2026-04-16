import { uid } from '../store/useStore'

// Columns and payroll items for each template.
// columns → data-entry table; items → PayrollBuilder line items.

function makeItems(defs) {
  return defs.map(d => ({ ...d, id: uid() }))
}
function makeCols(names) {
  return names.map(name => ({ id: uid(), name }))
}

export const TEMPLATES = [
  {
    id: 'georgia',
    name: 'Georgia Production',
    icon: '🌲',
    color: '#2e7d32',
    columns: makeCols(['FEEDER', 'CREW', 'DATE', 'NOTES']),
    items: makeItems([
      { label: 'C6M',             unit: 'ft', code: 'C6M',      rate1: 0.13, rate2: 0.09, rate3: 0.05, divBy2: false },
      { label: 'PM11',            unit: 'ft', code: 'PM11',     rate1: 1.01, rate2: 1.01, rate3: null,  divBy2: true  },
      { label: 'PFI-3 (PE13)',    unit: 'ea', code: 'PE13',     rate1: 2.07, rate2: 2.07, rate3: null,  divBy2: true  },
      { label: 'PM2A',            unit: 'ft', code: 'PM2A',     rate1: 1.35, rate2: 1.35, rate3: null,  divBy2: true  },
      { label: 'Make Ready C',    unit: 'ea', code: 'MRC',      rate1: 25,   rate2: 25,   rate3: null,  divBy2: true  },
      { label: 'Make Ready S',    unit: 'ea', code: 'MRS',      rate1: 25,   rate2: 25,   rate3: null,  divBy2: true  },
      { label: 'RCD',             unit: 'ea', code: 'RCD',      rate1: 9,    rate2: 9,    rate3: null,  divBy2: true  },
      { label: 'PF33 Anchor',     unit: 'ea', code: 'PF33',     rate1: 40,   rate2: 40,   rate3: null,  divBy2: true  },
      { label: 'PF33 Aux',        unit: 'ea', code: 'PF33AUX',  rate1: 1.68, rate2: 1.68, rate3: null,  divBy2: true  },
      { label: 'Fibra 24',        unit: 'ft', code: 'CO24',     rate1: 0.13, rate2: 0.09, rate3: 0.05, divBy2: false },
      { label: 'Fibra 48',        unit: 'ft', code: 'CO48',     rate1: 0.13, rate2: 0.09, rate3: 0.05, divBy2: false },
      { label: 'Fibra 96',        unit: 'ft', code: 'CO96',     rate1: 0.13, rate2: 0.09, rate3: 0.05, divBy2: false },
      { label: 'Fibra 144',       unit: 'ft', code: 'CO144',    rate1: 0.13, rate2: 0.09, rate3: 0.05, divBy2: false },
      { label: 'Fibra 288',       unit: 'ft', code: 'CO288',    rate1: 0.13, rate2: null, rate3: null,  divBy2: false },
      { label: 'MR-DE',           unit: 'ea', code: 'MR-DE',    rate1: 25,   rate2: 25,   rate3: null,  divBy2: true  },
      { label: 'Emergency EACA',  unit: 'ea', code: 'EACA',     rate1: 40,   rate2: 25,   rate3: null,  divBy2: true  },
      { label: 'Riser (BM80T)',   unit: 'ea', code: 'RISER',    rate1: 1.35, rate2: 1.35, rate3: null,  divBy2: true  },
      { label: 'PMSL',            unit: 'ea', code: 'PMSL',     rate1: 10,   rate2: 10,   rate3: null,  divBy2: true  },
      { label: 'Overlash',        unit: 'ft', code: 'OVERLASH', rate1: 0.10, rate2: 0.07, rate3: null,  divBy2: false },
    ]),
  },
  {
    id: 'selma',
    name: 'Selma, Alabama',
    icon: '🏙️',
    color: '#1565c0',
    columns: makeCols(['SUBSECTOR', 'CREW', 'DATE', 'NOTES']),
    items: makeItems([
      { label: 'Strand',               unit: 'ft', code: 'FP23F',          rate1: 0.14, rate2: 0.10, rate3: 0.05, divBy2: false },
      { label: 'Fiber',                unit: 'ft', code: 'FP21F',          rate1: 0.14, rate2: 0.10, rate3: 0.05, divBy2: false },
      { label: 'Tree Trim',            unit: 'ft', code: 'FPTT',           rate1: 0.40, rate2: 0.30, rate3: 0.05, divBy2: false },
      { label: 'Snowshoe',             unit: 'ea', code: 'FPSS',           rate1: 20,   rate2: 20,   rate3: null,  divBy2: true  },
      { label: 'Make Ready (100)',      unit: 'ea', code: 'FMMST 100',      rate1: 0.12, rate2: 0.08, rate3: null,  divBy2: true  },
      { label: 'Make Ready (350-2000)', unit: 'ea', code: 'FMMST 350-2000', rate1: 0.13, rate2: 0.09, rate3: null,  divBy2: true  },
      { label: 'Make Ready Drop',       unit: 'ea', code: 'MAKE READY',     rate1: 15,   rate2: 15,   rate3: null,  divBy2: true  },
      { label: 'Down Guy',             unit: 'ea', code: 'FPDG',           rate1: 7,    rate2: 7,    rate3: null,  divBy2: true  },
      { label: 'Overhead Guy',         unit: 'ea', code: 'FPOG',           rate1: 9,    rate2: 9,    rate3: null,  divBy2: true  },
      { label: 'Anchor',               unit: 'ea', code: 'FPAN',           rate1: 25,   rate2: 25,   rate3: null,  divBy2: true  },
      { label: 'Riser',                unit: 'ea', code: 'FPRS',           rate1: 10,   rate2: 10,   rate3: null,  divBy2: true  },
    ]),
  },
]
