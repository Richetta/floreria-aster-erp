export interface ElementLayout {
    // All coordinates as percentages (0-100) relative to label width/height
    x: number;  // left position %
    y: number;  // top position %
    w: number;  // width %
    h: number;  // height %
    visible: boolean;
    fontSize?: number;  // pt for print, px for editor (will be scaled)
    fontWeight?: number;
}

export interface LabelLayoutConfig {
    width: number;   // label width in mm
    height: number;  // label height in mm
    name: ElementLayout;
    barcode: ElementLayout;
    code: ElementLayout;
    price: ElementLayout;
}

// Default layout using percentage-based coordinates
export const defaultLabelLayout: LabelLayoutConfig = {
    width: 50,
    height: 25,
    name: {
        x: 2,
        y: 2,
        w: 96,
        h: 20,
        visible: true,
        fontSize: 7,
        fontWeight: 700
    },
    barcode: {
        x: 5,
        y: 22,
        w: 90,
        h: 55,
        visible: true
    },
    code: {
        x: 5,
        y: 78,
        w: 90,
        h: 14,
        visible: true,
        fontSize: 6,
        fontWeight: 500
    },
    price: {
        x: 5,
        y: 82,
        w: 90,
        h: 16,
        visible: false,
        fontSize: 7,
        fontWeight: 800
    }
};

export const getSavedLabelLayout = (): LabelLayoutConfig => {
    try {
        const saved = localStorage.getItem('aster_label_layout_v2');
        if (saved) return JSON.parse(saved);
    } catch {
        // ignore
    }
    return defaultLabelLayout;
};

export const saveLabelLayout = (layout: LabelLayoutConfig) => {
    localStorage.setItem('aster_label_layout_v2', JSON.stringify(layout));
};
