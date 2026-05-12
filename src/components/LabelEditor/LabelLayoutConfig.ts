export interface ElementLayout {
    x: number;
    y: number;
    w: number;
    h: number;
    visible: boolean;
    fontSize?: number;
    fontWeight?: number;
}

export interface LabelLayoutConfig {
    width: number;  // overall label width in mm (default 50)
    height: number; // overall label height in mm (default 25)
    name: ElementLayout;
    barcode: ElementLayout;
    code: ElementLayout;
    price: ElementLayout;
}

// Convert mm to px for the editor display (e.g., 1mm = 3.78px for standard 96dpi)
export const MM_TO_PX = 3.78;

// We use an internal coordinate system in px for the editor, then map back to mm or relative percentages for print
export const defaultLabelLayout: LabelLayoutConfig = {
    width: 50,
    height: 25,
    name: {
        x: 10,
        y: 2,
        w: 170,
        h: 20,
        visible: true,
        fontSize: 14,
        fontWeight: 700
    },
    barcode: {
        x: 20,
        y: 22,
        w: 150,
        h: 40,
        visible: true
    },
    code: {
        x: 10,
        y: 65,
        w: 170,
        h: 15,
        visible: true,
        fontSize: 10,
        fontWeight: 500
    },
    price: {
        x: 10,
        y: 80,
        w: 170,
        h: 20,
        visible: true,
        fontSize: 16,
        fontWeight: 800
    }
};

export const getSavedLabelLayout = (): LabelLayoutConfig => {
    try {
        const saved = localStorage.getItem('aster_label_layout');
        if (saved) return JSON.parse(saved);
    } catch {
        // ignore
    }
    return defaultLabelLayout;
};

export const saveLabelLayout = (layout: LabelLayoutConfig) => {
    localStorage.setItem('aster_label_layout', JSON.stringify(layout));
};
