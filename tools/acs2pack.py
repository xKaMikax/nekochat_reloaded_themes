"""Turns a Microsoft Agent character (.acs) into a Nekochat Reloaded assistant pack.

    python3 tools/acs2pack.py Merlin.acs assistants/merlin

Writes agent.json (the animations), frames.png (every image in one atlas), sound<N>.wav and
Preview.png. Needs Pillow."""
import struct


class Reader:
    def __init__(self, data, pos=0):
        self.d = data; self.p = pos
    def u8(self): v = self.d[self.p]; self.p += 1; return v
    def u16(self): v = struct.unpack_from('<H', self.d, self.p)[0]; self.p += 2; return v
    def s16(self): v = struct.unpack_from('<h', self.d, self.p)[0]; self.p += 2; return v
    def u32(self): v = struct.unpack_from('<I', self.d, self.p)[0]; self.p += 4; return v
    def s32(self): v = struct.unpack_from('<i', self.d, self.p)[0]; self.p += 4; return v
    def raw(self, n): v = self.d[self.p:self.p + n]; self.p += n; return v
    def guid(self): return self.raw(16)
    def string(self):
        n = self.u32()
        if n == 0: return ''
        s = self.d[self.p:self.p + n * 2].decode('utf-16-le'); self.p += n * 2 + 2
        return s
    def locator(self): return self.u32(), self.u32()


def decompress(src):
    if not src or src[0] != 0:
        raise ValueError('not compressed data')
    out = bytearray()
    pos = 8  # bit position, after the leading zero byte
    total = len(src) * 8
    def bits(n):
        nonlocal pos
        v = 0
        for i in range(n):
            byte = src[pos >> 3]
            v |= ((byte >> (pos & 7)) & 1) << i
            pos += 1
        return v
    while pos < total:
        if bits(1) == 0:
            out.append(bits(8)); continue
        n = 0
        while n < 3 and bits(1) == 1:
            n += 1
        if n == 0: offset, count = bits(6) + 1, 2
        elif n == 1: offset, count = bits(9) + 65, 2
        elif n == 2: offset, count = bits(12) + 577, 2
        else:
            offset = bits(20)
            if offset == 0xFFFFF: break
            offset += 4673; count = 3
        k = 0
        while k < 12 and bits(1) == 1:
            k += 1
        if k > 11: raise ValueError('bad length')
        if k: count += bits(k) + (1 << k) - 1
        for _ in range(count):
            out.append(out[-offset])
    return bytes(out)


class Character:
    def __init__(self, data):
        r = Reader(data)
        if r.u32() != 0xABCDABC3: raise ValueError('not an ACS file')
        self.data = data
        char_loc, anim_loc, image_loc, audio_loc = r.locator(), r.locator(), r.locator(), r.locator()
        self._character(char_loc[0])
        self.animations = {}
        r = Reader(data, anim_loc[0])
        for _ in range(r.u32()):
            name = r.string(); off, size = r.locator()
            self.animations[name] = off
        r = Reader(data, image_loc[0])
        self.images = [(lambda o, s, c: (o, s))(*r.locator(), r.u32()) for _ in range(r.u32())]
        r = Reader(data, audio_loc[0])
        self.audio = [(lambda o, s, c: (o, s))(*r.locator(), r.u32()) for _ in range(r.u32())]

    def _character(self, pos):
        r = Reader(self.data, pos)
        r.u16(); r.u16(); r.locator(); r.guid()
        self.width, self.height = r.u16(), r.u16()
        self.transparent = r.u8()
        flags = r.u32()
        r.u16(); r.u16()
        if flags & 0x20:  # voice output
            r.guid(); r.guid(); r.u32(); r.u16()
            if r.u8():
                r.u16(); r.string(); r.u16(); r.u16(); r.string()
        if flags & 0x200:  # balloon
            r.u8(); r.u8(); r.raw(12); r.string(); r.s32(); r.s32(); r.u8(); r.u8()
        count = r.u32()
        self.palette = [tuple(r.raw(4)[:3][::-1]) for _ in range(count)]  # RGBQUAD is BGR0

    def image(self, index):
        off, size = self.images[index]
        r = Reader(self.data, off)
        r.u8(); w = r.u16(); h = r.u16(); compressed = r.u8()
        n = r.u32(); blob = r.raw(n)
        pixels = decompress(blob) if compressed else blob
        return w, h, pixels

    def animation(self, name):
        r = Reader(self.data, self.animations[name])
        r.string(); transition = r.u8(); ret = r.string()
        frames = []
        for _ in range(r.u16()):
            images = [(r.u32(), r.s16(), r.s16()) for _ in range(r.u16())]
            audio = r.u16(); duration = r.u16(); exit_frame = r.s16()
            branches = [(r.u16(), r.u16()) for _ in range(r.u8())]
            overlays = []
            for _ in range(r.u8()):
                kind = r.u8(); replace = r.u8(); image = r.u16(); r.u8(); region = r.u8(); x = r.s16(); y = r.s16(); w = r.u16(); h = r.u16()
                if region: r.raw(r.u32())
                overlays.append((kind, replace, image, x, y))
            frames.append({'images': images, 'audio': audio, 'duration': duration, 'exit': exit_frame, 'branches': branches, 'overlays': overlays})
        return {'transition': transition, 'return': ret, 'frames': frames}

    def sound(self, index):
        off, size = self.audio[index]
        return self.data[off:off + size]


def export(acs_path, folder):
    """Writes agent.json, frames.png, sound<N>.wav and Preview.png of an assistant pack."""
    import json, math, os
    from PIL import Image
    character = Character(open(acs_path, 'rb').read())
    os.makedirs(folder, exist_ok=True)
    width, height, columns = character.width, character.height, 32
    count = len(character.images)
    atlas = Image.new('P', (columns * width, math.ceil(count / columns) * height), character.transparent)
    palette = []
    for colour in character.palette: palette.extend(colour)
    atlas.putpalette(palette)
    for index in range(count):
        w, h, pixels = character.image(index); stride = (w + 3) & ~3
        rows = b''.join(pixels[(h - 1 - y) * stride:(h - 1 - y) * stride + w] for y in range(h))
        atlas.paste(Image.frombytes('P', (w, h), rows), ((index % columns) * width, (index // columns) * height))
    atlas.save(os.path.join(folder, 'frames.png'), optimize=True, transparency=character.transparent)
    animations = {name: character.animation(name) for name in character.animations}
    name = os.path.splitext(os.path.basename(acs_path))[0].title()
    json.dump({'name': name, 'sounds': len(character.audio), 'width': width, 'height': height, 'columns': columns, 'animations': animations},
              open(os.path.join(folder, 'agent.json'), 'w'), separators=(',', ':'))
    files = ['agent.json', 'frames.png']
    for index in range(len(character.audio)):
        open(os.path.join(folder, f'sound{index}.wav'), 'wb').write(character.sound(index)); files.append(f'sound{index}.wav')
    # Preview: the rest pose (or the first frame) on white.
    first = (animations.get('RestPose') or next(iter(animations.values())))['frames'][0]
    atlas.info['transparency'] = character.transparent
    rgba = atlas.convert('RGBA'); preview = Image.new('RGBA', (width, height), (255, 255, 255, 255))
    for image, x, y in reversed(first['images']):
        tile = rgba.crop(((image % columns) * width, (image // columns) * height, (image % columns + 1) * width, (image // columns + 1) * height))
        preview.alpha_composite(tile, (x, y))
    preview.save(os.path.join(folder, 'Preview.png'))
    return name, files


if __name__ == '__main__':
    import sys
    if len(sys.argv) != 3:
        raise SystemExit('usage: acs2pack.py CHARACTER.acs OUTPUT_FOLDER')
    name, files = export(sys.argv[1], sys.argv[2])
    print(f'{name}: {len(files)} files. Add them to packs.json as "Files": {files}')
