import { fraction as f } from './musical-time.js';

// Original pulse-relative figures. Each style repeats a four-pulse phrase;
// odd and compound meters retain their existing grouped pulse durations.
const hit = (at, velocity = 1) => ({ at: f(at, 12), velocity });
const hits = values => values.map(value => hit(...(Array.isArray(value) ? value : [value])));
const drums = (sound, values, velocity) => hits(values).map(h => ({ ...h, sound, velocity: h.velocity * velocity }));
export const GROOVE_STYLES = ['jazzTwoFeel', 'shuffle', 'samba', 'mambo', 'bolero', 'funk', 'reggae', 'disco', 'pop', 'country'];

export function grooveFor(style, beat, bar) {
  const b = beat % 4, even = b % 2 === 0;
  let bass, piano, drum, gate = f(3,4);
  switch (style) {
    case 'jazzTwoFeel':
      bass = even ? [0] : []; piano = even ? [0] : [8]; gate = f(11,12);
      drum = [...drums('hat', even ? [0] : [0,8], .3), ...drums(even ? 'kick' : 'snare', [0], .22)]; break;
    case 'shuffle':
      bass = [0,8]; piano = [0,8]; gate = f(1,2);
      drum = [...drums('hat',[0,[8,.7]],.42), ...drums(even ? 'kick':'snare',[0],.56)]; break;
    case 'samba':
      bass = even ? [0,9] : [6]; piano = (bar % 2) ? [3,9] : even ? [0,9] : [6]; gate = f(1,2);
      drum = [...drums('hat',[0,3,6,9],.24), ...drums('kick',even ? [0,9]:[6],.48), ...drums('snare',even ? [6]:[3,9],.25)]; break;
    case 'mambo':
      bass = even ? [0] : [6,9]; piano = even ? [3,9] : [0,6]; gate = f(1,2);
      drum = [...drums('hat',[0,6],.35), ...drums('snare',b===0 ? [0,6]:b===1 ? [6]:b===2 ? [0]:[6],.4), ...drums('kick',even ? [0]:[],.45)]; break;
    case 'bolero':
      bass = even ? [0] : [6]; piano = even ? [0] : [3,9]; gate = f(7,8);
      drum = [...drums('hat',[0,6],.2), ...drums('snare',[3,6,9],.16), ...drums('kick',even ? [0]:[],.28)]; break;
    case 'funk':
      bass = even ? [0,9] : [3,6]; piano = even ? [3,9] : [6]; gate = f(1,3);
      drum = [...drums('hat',[0,[3,.5],6,[9,.6]],.4), ...drums('kick',even ? [0,9]:[6],.62), ...drums('snare',even ? [[9,.3]]:[0],.6)]; break;
    case 'reggae':
      bass = b===0 ? [0,6] : b===2 ? [0] : [9]; piano = [6]; gate = f(1,3);
      drum = [...drums('hat',[0,6],.26), ...drums('kick',b===2 ? [0]:[],.58), ...drums('snare',b===2 ? [0]:[],.42)]; break;
    case 'disco':
      bass = [0,6]; piano = even ? [6] : [0,6]; gate = f(1,2);
      drum = [...drums('kick',[0],.6), ...drums('hat',[[0,.45],6],.5), ...drums('snare',even ? []:[0],.55)]; break;
    case 'pop':
      bass = b===3 ? [0,9]:[0]; piano = even ? [0]:[6]; gate = f(7,8);
      drum = [...drums('hat',[0,6],.32), ...drums(even ? 'kick':'snare',[0],.52), ...drums('kick',b===2 ? [9]:[],.4)]; break;
    case 'country':
      bass = even ? [0]:[]; piano = even ? []:[0,6]; gate = f(1,2);
      drum = [...drums('hat',[0,6],.25), ...drums(even ? 'kick':'snare',[0],.38), ...drums('snare',even ? []:[[9,.35]],.3)]; break;
    default: return null;
  }
  return { bass: hits(bass), piano: hits(piano), drums: drum, gate };
}
