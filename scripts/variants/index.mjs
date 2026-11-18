// The variant sources make-variants.mjs reads, after the registry's (registry-fold.mjs). Each exports VARIANTS
// ([key, name, fr, equipment, aliases, extra?], key "base--suffix", src/lib/variant-key.js) and may export ALIAS
// ({ key: [names] }, a base's or a variant's).
import * as fedbBarbell from './fedb-barbell.mjs';
import * as fedbDumbbell from './fedb-dumbbell.mjs';
import * as fedbCableMachine from './fedb-cable-machine.mjs';
import * as fedbKettlebellBandsBalls from './fedb-kettlebell-bands-balls.mjs';
import * as fedbBodyweightOther from './fedb-bodyweight-other.mjs';
import * as commercialGym from './commercial-gym.mjs';

export const SOURCES = [fedbBarbell, fedbDumbbell, fedbCableMachine, fedbKettlebellBandsBalls, fedbBodyweightOther, commercialGym];
