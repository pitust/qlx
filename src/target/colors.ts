function rgb_to_hsv(r: number, g: number, b: number) {
    var max = Math.max(r, g, b),
        min = Math.min(r, g, b),
        d = max - min,
        h: number,
        s = max === 0 ? 0 : d / max,
        v = max / 255

    switch (max) {
        case min:
            h = 0
            break
        case r:
            h = g - b + d * (g < b ? 6 : 0)
            h /= 6 * d
            break
        case g:
            h = b - r + d * 2
            h /= 6 * d
            break
        case b:
            h = r - g + d * 4
            h /= 6 * d
            break
    }

    return {
        h: h,
        s: s,
        v: v,
    }
}
function hsv_to_rgb(h: number, s: number, v: number) {
    var r: number, g: number, b: number
    let i = Math.floor(h * 6)
    let f = h * 6 - i
    let p = v * (1 - s)
    let q = v * (1 - f * s)
    let t = v * (1 - (1 - f) * s)
    switch (i % 6) {
        case 0:
            ;(r = v), (g = t), (b = p)
            break
        case 1:
            ;(r = q), (g = v), (b = p)
            break
        case 2:
            ;(r = p), (g = v), (b = t)
            break
        case 3:
            ;(r = p), (g = q), (b = v)
            break
        case 4:
            ;(r = t), (g = p), (b = v)
            break
        case 5:
            ;(r = v), (g = p), (b = q)
            break
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
    }
}

function randomize(seed: number) {
    seed++

    seed ^= seed << 13
    seed ^= seed >> 17
    seed ^= seed << 5

    return Math.abs(seed)
}

export function allocateColors(count: number) {
    let step = 1 / count
    let colors: string[] = []

    let seed = randomize(count)

    for (let i = 0; i < count; i++) {
        const color = hsv_to_rgb(step * i, 0.82, 0.97)
        const finalColor =
            '#' +
            [
                Math.floor(color.r).toString(16).padStart(2, '0'),
                Math.floor(color.g).toString(16).padStart(2, '0'),
                Math.floor(color.b).toString(16).padStart(2, '0'),
            ].join('')
        const midpoint = seed % colors.length
        colors = [colors.slice(0, midpoint), [finalColor], colors.slice(midpoint)].flat()
        seed = randomize(seed)
    }

    return colors
}
