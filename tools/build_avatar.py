# =====================================================================
# build_avatar.py – a MakeHuman (CC0) alapmodellből a böngésző számára
# kompakt bináris csomagot készít: frontend/public/avatar/avatar.bin + avatar.json
#
# Futtatás (egyszer kell, az eredmény a repóban van):
#   python tools/build_avatar.py <makehuman_repo>/makehuman/data
#
# Mi kerül bele:
#   - a test pontjai és háromszögei (csak a "body" csoport, segédgeometria nélkül)
#   - az ízületek segédpontjai (váll, könyök, csípő, térd...), hogy bármilyen
#     testméretnél tudjuk, hol vannak az ízületek
#   - morph targetek: nem + súly (makró), magasság, mell/derék/csípő kerület
#   - minden ponthoz egy testrész-címke a csontváz súlyaiból (fej, mellkas, felkar...)
#   - szomszédsági lista a simításhoz (arc, ruhák)
# A MakeHuman fájlok CC0 licencűek (2020 szeptember óta), szabadon felhasználhatók.
# =====================================================================

import json                                  # JSON fájlok írása/olvasása
import os                                    # útvonalak kezelése
import sys                                   # parancssori paraméterek
from array import array                      # tömör számtömbök (float32, int16...)

DATA = sys.argv[1] if len(sys.argv) > 1 else 'makehuman/data'  # a MakeHuman data mappa helye
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'avatar')  # ide írjuk az eredményt

# --- Testrész-kódok: a csontváz csontjait 12 egyszerű csoportba soroljuk ---
REGIONS = ['head', 'neck', 'chest', 'abdomen', 'pelvis', 'shoulder', 'upperarm', 'lowerarm', 'hand', 'upperleg', 'lowerleg', 'foot']  # a kódok sorrendje = a számuk


def region_of_bone(bone):                    # csontnévből testrész-kód
    b = bone.split('.')[0]                   # a .L / .R oldaljelölés levágása
    if b.startswith(('neck',)):              # nyakcsigolyák
        return 'neck'                        # nyak
    if b.startswith(('spine01', 'spine02', 'breast', 'clavicle')):  # felső gerinc (a MakeHuman fentről számoz!), mell, kulcscsont
        return 'chest'                       # mellkas
    if b.startswith(('spine03', 'spine04', 'spine05')):  # alsó gerinc
        return 'abdomen'                     # has, derék
    if b.startswith(('pelvis', 'root')):     # medence
        return 'pelvis'                      # medence, csípő
    if b.startswith('shoulder'):             # vállcsont
        return 'shoulder'                    # váll
    if b.startswith('upperarm'):             # felkar
        return 'upperarm'                    # felkar
    if b.startswith('lowerarm'):             # alkar
        return 'lowerarm'                    # alkar
    if b.startswith(('wrist', 'metacarpal', 'finger')):  # csukló, kézközép, ujjak
        return 'hand'                        # kéz
    if b.startswith('upperleg'):             # comb
        return 'upperleg'                    # comb
    if b.startswith('lowerleg'):             # lábszár
        return 'lowerleg'                    # lábszár
    if b.startswith(('foot', 'toe')):        # lábfej, lábujjak
        return 'foot'                        # lábfej
    return 'head'                            # minden más (arc izmai, szem, állkapocs, nyelv) a fejhez tartozik


# --- Az ízületek, amelyeknek a helyét a futás közben ki kell számolni ---
JOINTS = ['joint-pelvis', 'joint-spine-1', 'joint-spine-2', 'joint-spine-3', 'joint-spine-4', 'joint-neck', 'joint-head', 'joint-ground']  # törzs ízületei
for side in ('l', 'r'):                      # bal és jobb oldal
    for j in ('clavicle', 'shoulder', 'elbow', 'hand', 'upper-leg', 'knee', 'ankle'):  # végtag ízületek
        JOINTS.append(f'joint-{side}-{j}')   # pl. joint-l-shoulder


def read_obj(path):                          # az alapmodell beolvasása
    verts = []                               # az összes pont
    faces = []                               # (csoport, pontindexek) párok
    group = None                             # az aktuális csoport neve
    with open(path) as fh:                   # fájl megnyitása
        for line in fh:                      # soronként
            if line.startswith('v '):        # pont sor
                verts.append(tuple(float(t) for t in line.split()[1:4]))  # x, y, z
            elif line.startswith('g '):      # csoport sor
                group = line.split()[1]      # a csoport neve
            elif line.startswith('f '):      # lap sor (3 vagy 4 pont)
                faces.append((group, [int(t.split('/')[0]) - 1 for t in line.split()[1:]]))  # 0-tól számozott indexek
    return verts, faces                      # pontok és lapok


def read_target(path):                       # egy .target fájl: "index dx dy dz" sorok
    deltas = {}                              # index → (dx, dy, dz)
    with open(path) as fh:                   # fájl megnyitása
        for line in fh:                      # soronként
            if not line.strip() or line.startswith('#'):  # üres és megjegyzés sorok kihagyása
                continue                     # tovább
            parts = line.split()             # szóközöknél szétszedés
            deltas[int(parts[0])] = (float(parts[1]), float(parts[2]), float(parts[3]))  # eltolás eltárolása
    return deltas                            # a target eltolásai


def combine(*weighted):                      # több target súlyozott összege: combine((0.5, t1), (1, t2))
    out = {}                                 # eredmény
    for w, t in weighted:                    # minden súly + target párra
        for i, d in t.items():               # minden eltolt pontra
            o = out.get(i, (0.0, 0.0, 0.0))  # eddigi összeg
            out[i] = (o[0] + w * d[0], o[1] + w * d[1], o[2] + w * d[2])  # hozzáadás
    return out                               # összegzett target


def main():                                  # a fő program
    verts, faces = read_obj(os.path.join(DATA, '3dobjs', 'base.obj'))  # alapmodell
    body_faces = [f for g, f in faces if g == 'body']  # csak a test lapjai (a szem, haj, fog segédgeometria nem kell)
    body_set = sorted({i for f in body_faces for i in f})  # a test pontjai (eredeti indexek)
    joint_groups = {}                        # ízület neve → eredeti pontindexek
    for g, f in faces:                       # a segédcsoportok lapjai
        if g in JOINTS:                      # ha ez egy szükséges ízület
            joint_groups.setdefault(g, set()).update(f)  # a pontjai
    joint_set = sorted({i for s in joint_groups.values() for i in s} - set(body_set))  # az ízületi pontok (a testtől külön)
    order = body_set + joint_set             # új sorrend: előbb a test, utána az ízületi pontok
    remap = {old: new for new, old in enumerate(order)}  # eredeti index → új index
    n_body = len(body_set)                   # a test pontjainak száma
    n_all = len(order)                       # összes pont

    tris = []                                # háromszögek az új indexekkel
    for f in body_faces:                     # minden test lapra
        idx = [remap[i] for i in f]          # átszámozás
        tris.extend([idx[0], idx[1], idx[2]])  # első háromszög
        if len(idx) == 4:                    # négyszög esetén...
            tris.extend([idx[0], idx[2], idx[3]])  # ...a második háromszög

    # --- Lyukak lezárása: a test hálóján a szemüreg nyitott (a szemgolyó külön segédgeometria volt) ---
    directed = set()                         # irányított élek a háromszögekből
    for t in range(0, len(tris), 3):         # minden háromszögre
        a, b, c = tris[t], tris[t + 1], tris[t + 2]  # a három csúcs
        directed.update(((a, b), (b, c), (c, a)))  # a három él körüljárás szerint
    rev_next = {b: a for (a, b) in directed if (b, a) not in directed}  # határél: nincs párja; a fordított irányt követjük
    loops = []                               # a lyukak peremei
    seen = set()                             # már bejárt peremcsúcsok
    for start in list(rev_next):             # minden peremcsúcsból
        if start in seen:                    # ha már benne van egy peremben
            continue                         # kihagyjuk
        loop = [start]                       # új perem
        seen.add(start)                      # bejártnak jelöljük
        v = rev_next[start]                  # a következő peremcsúcs
        while v != start and v not in seen:  # körbe, amíg vissza nem érünk
            loop.append(v)                   # hozzáadjuk
            seen.add(v)                      # bejártnak jelöljük
            v = rev_next.get(v, start)       # tovább
        loops.append(loop)                   # a perem kész
    for loop in loops:                       # minden lyukat
        for k in range(1, len(loop) - 1):    # legyezőszerűen háromszögekkel töltünk ki
            tris.extend([loop[0], loop[k], loop[k + 1]])  # a perem fordított körüljárása miatt kifelé néz
    print('Lezárt lyukak (peremhossz):', sorted(len(l) for l in loops))  # tájékoztatás

    # --- Testrész-címkék a csontváz súlyaiból: minden pont a legnagyobb súlyú csonté ---
    weights = json.load(open(os.path.join(DATA, 'rigs', 'default_weights.mhw')))['weights']  # csont → [[index, súly], ...]
    best = {}                                # eredeti index → (súly, csont)
    for bone, pairs in weights.items():      # minden csontra
        for i, w in pairs:                   # minden pontjára
            if i not in best or w > best[i][0]:  # ha ez a csont erősebb
                best[i] = (w, bone)          # megjegyezzük
    labels = array('B', [255] * n_all)       # címkék (255 = nincs, pl. ízületi segédpont)
    for old in body_set:                     # a test pontjain
        bone = best.get(old, (0, 'head'))[1]  # a legerősebb csont
        labels[remap[old]] = REGIONS.index(region_of_bone(bone))  # a testrész kódja

    # --- Szomszédsági lista (CSR formátum): melyik pont melyikkel van összekötve ---
    neigh = [set() for _ in range(n_body)]   # pontonként a szomszédok halmaza
    for t in range(0, len(tris), 3):         # minden háromszögre
        a, b, c = tris[t], tris[t + 1], tris[t + 2]  # a három csúcs
        neigh[a].update((b, c)); neigh[b].update((a, c)); neigh[c].update((a, b))  # kölcsönös szomszédság
    adj_off = array('I', [0])                # kezdőpozíciók tömbje
    adj = array('H')                         # a szomszédok egymás után
    for s in neigh:                          # pontonként
        adj.extend(sorted(s))                # a szomszédok
        adj_off.append(len(adj))             # a következő pont kezdete

    T = lambda *p: read_target(os.path.join(DATA, 'targets', *p))  # rövidítés a targetek beolvasásához
    dense, sparse = {}, {}                   # sűrű (minden pontot mozgató) és ritka targetek
    for g in ('female', 'male'):             # nemenként
        races = [T('macrodetails', f'{r}-{g}-young.target') for r in ('caucasian', 'african', 'asian')]  # három rassz, átlagolva semleges
        for wl in ('minweight', 'averageweight', 'maxweight'):  # három súlyszint
            uni = T('macrodetails', f'universal-{g}-young-averagemuscle-{wl}.target')  # a nem + súly target
            dense[f'macro_{g}_{wl}'] = combine((1.0, uni), *[(1 / 3, r) for r in races])  # makró: nem + súly + átlagos rassz
            for h in ('minheight', 'maxheight'):  # alacsony és magas irány
                dense[f'height_{g}_{wl}_{h}'] = T('macrodetails', 'height', f'{g}-young-averagemuscle-{wl}-{h}.target')  # magasság target
    for m in ('bust', 'waist', 'hips', 'underbust', 'thigh', 'upperarm'):  # körméret targetek
        for d in ('incr', 'decr'):           # növelés és csökkentés
            sparse[f'{m}_{d}'] = T('measure', f'measure-{m}-circ-{d}.target')  # pl. measure-waist-circ-incr

    # --- Bináris fájl összeállítása ---
    blob = bytearray()                       # a bináris tartalom
    meta = {                                 # a JSON leíró
        'source': 'MakeHuman 1.x base mesh, targets and weights (CC0, makehumancommunity/makehuman)',  # forrás
        'units': 'dm',                       # mértékegység: deciméter (a böngésző méterre váltja)
        'nBody': n_body, 'nAll': n_all, 'nTris': len(tris) // 3,  # darabszámok
        'regions': REGIONS,                  # testrész-kódok nevei
        'sections': {}, 'dense': {}, 'sparse': {}, 'joints': {},  # később töltjük ki
    }                                        # meta vége

    def put(name, arr):                      # egy tömb hozzáfűzése 4 bájtra igazítva
        while len(blob) % 4:                 # igazítás (a Float32Array csak 4-gyel osztható helyről olvasható)
            blob.append(0)                   # kitöltő bájt
        meta['sections'][name] = [len(blob), len(arr)]  # hol kezdődik és hány elem
        blob.extend(arr.tobytes())           # a tömb bájtjai

    put('base', array('f', [c for i in order for c in verts[i]]))  # alap pontok (float32)
    put('index', array('H', tris))           # háromszögek (uint16)
    put('labels', labels)                    # testrész-címkék (uint8)
    put('adjOffset', adj_off)                # szomszédsági kezdőpozíciók (uint32)
    put('adj', adj)                          # szomszédok (uint16)

    for name, t in dense.items():            # sűrű targetek: minden ponthoz 3 szám
        vals = [0.0] * (n_all * 3)           # nullákkal kitöltve
        for old, d in t.items():             # az eltolt pontok
            if old in remap:                 # ha használjuk ezt a pontot
                j = remap[old] * 3           # hely a tömbben
                vals[j], vals[j + 1], vals[j + 2] = d  # az eltolás
        scale = max(1e-9, max(abs(v) for v in vals)) / 32767  # int16-ra skálázás (így fele akkora a fájl)
        put('d_' + name, array('h', [round(v / scale) for v in vals]))  # egész számokként
        meta['dense'][name] = scale          # a visszaszorzó

    for name, t in sparse.items():           # ritka targetek: csak az eltolt pontok
        items = [(remap[o], d) for o, d in t.items() if o in remap]  # használt pontok
        scale = max(1e-9, max(abs(c) for _, d in items for c in d)) / 32767  # skálázás
        put('si_' + name, array('H', [i for i, _ in items]))  # pontindexek
        put('sd_' + name, array('h', [round(c / scale) for _, d in items for c in d]))  # eltolások
        meta['sparse'][name] = scale         # a visszaszorzó

    for g, s in joint_groups.items():        # ízületek
        meta['joints'][g.replace('joint-', '')] = [remap[i] for i in sorted(s)]  # az ízület pontjai (a közepük az ízület helye)

    os.makedirs(OUT_DIR, exist_ok=True)      # a célmappa létrehozása
    with open(os.path.join(OUT_DIR, 'avatar.bin'), 'wb') as fh:  # bináris fájl
        fh.write(blob)                       # kiírás
    with open(os.path.join(OUT_DIR, 'avatar.json'), 'w') as fh:  # leíró fájl
        json.dump(meta, fh)                  # kiírás
    print(f'Kész: {n_body} testpont, {n_all - n_body} ízületi pont, {len(tris) // 3} háromszög, {len(blob) / 1e6:.2f} MB')  # összefoglaló


if __name__ == '__main__':                   # ha közvetlenül futtatják
    main()                                   # a fő program indítása
