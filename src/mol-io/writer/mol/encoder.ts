/**
 * Copyright (c) 2020 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Sebastian Bittrich <sebastian.bittrich@rcsb.org>
 */

import { StringBuilder } from '../../../mol-util';
import { Category } from '../cif/encoder';
import { getCategoryInstanceData } from '../cif/encoder/util';
import { LigandEncoder } from '../ligand-encoder';

// specification: http://c4.cabrillo.edu/404/ctfile.pdf
// SDF wraps MOL and allows for multiple molecules per file as well as additional properties
// TODO add support for stereo/chiral flags, add charges
export class MolEncoder extends LigandEncoder {
    _writeCategory<Ctx>(category: Category<Ctx>, context?: Ctx) {
        // use separate builder because we still need to write Counts and Bonds line
        const ctab = StringBuilder.create();
        const bonds = StringBuilder.create();
        // write Atom block and gather data for Bonds and Charges
        const { instance, source } = getCategoryInstanceData(category, context);

        // write header
        const name = this.getName(instance, source);
        // 3rd lines must be present and can contain comments
        StringBuilder.writeSafe(this.builder, `${name}\n  ${this.encoder}\n\n`);

        const bondMap = this.componentData.entries.get(name)!;
        let bondCount = 0;

        // traverse once to determine all actually present atoms
        const atoms = this.getAtoms(instance, source);
        for (let i1 = 0, il = atoms.length; i1 < il; i1++) {
            const atom = atoms[i1];
            StringBuilder.writePadLeft(ctab, atom.Cartn_x.toFixed(4), 10);
            StringBuilder.writePadLeft(ctab, atom.Cartn_y.toFixed(4), 10);
            StringBuilder.writePadLeft(ctab, atom.Cartn_z.toFixed(4), 10);
            StringBuilder.whitespace1(ctab);
            StringBuilder.writePadRight(ctab, atom.type_symbol, 2);
            StringBuilder.writeSafe(ctab, '  0  0  0  0  0  0  0  0  0  0  0  0\n');

            bondMap.map.get(atom.label_atom_id)!.forEach((v, k) => {
                const i2 = atoms.findIndex(e => e.label_atom_id === k);
                const label2 = this.getLabel(k);
                if (i1 < i2 && atoms.findIndex(e => e.label_atom_id === k) > -1 && !this.skipHydrogen(label2)) {
                    const { order } = v;
                    StringBuilder.writeIntegerPadLeft(bonds, i1 + 1, 3);
                    StringBuilder.writeIntegerPadLeft(bonds, i2 + 1, 3);
                    StringBuilder.writeIntegerPadLeft(bonds, order, 3);
                    StringBuilder.writeSafe(bonds, '  0  0  0  0\n');
                    bondCount++;
                }
            });
        }

        // write counts line
        StringBuilder.writeIntegerPadLeft(this.builder, atoms.length, 3);
        StringBuilder.writeIntegerPadLeft(this.builder, bondCount, 3);
        StringBuilder.writeSafe(this.builder, '  0  0  0  0  0  0  0  0  0\n');

        StringBuilder.writeSafe(this.builder, StringBuilder.getString(ctab));
        StringBuilder.writeSafe(this.builder, StringBuilder.getString(bonds));

        StringBuilder.writeSafe(this.builder, 'M  END\n');
    }

    protected writeFullCategory<Ctx>(sb: StringBuilder, category: Category<Ctx>, context?: Ctx) {
        const { instance, source } = getCategoryInstanceData(category, context);
        const fields = instance.fields;
        const src = source[0];
        const data = src.data;

        const it = src.keys();
        const key = it.move();
        for (let _f = 0; _f < fields.length; _f++) {
            const f = fields[_f]!;

            StringBuilder.writeSafe(sb, `> <${category.name}.${f.name}>\n`);
            const val = f.value(key, data, 0);
            StringBuilder.writeSafe(sb, val as string);
            StringBuilder.writeSafe(sb, '\n\n');
        }
    }

    encode() {
        // write meta-information, do so after ctab
        if (this.error || this.metaInformation) {
            StringBuilder.writeSafe(this.builder, StringBuilder.getString(this.meta));
        }

        // terminate file (needed for SDF only)
        if (!!this.terminator) {
            StringBuilder.writeSafe(this.builder, `${this.terminator}\n`);
        }

        this.encoded = true;
    }

    constructor(encoder: string, metaInformation: boolean, hydrogens: boolean, readonly terminator: string = '') {
        super(encoder, metaInformation, hydrogens);

        if (metaInformation && !terminator) {
            throw new Error('meta-information cannot be written for MOL files');
        }
    }
}