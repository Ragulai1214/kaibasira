// Use the displayed score (largest connected peeled cluster), not total peeled count.
export function resultComment(score){
 if(score<=0)return '本日は、つまの盛り合わせです。';
 if(score<20)return 'ひとかけ貝柱、召し上がれ';
 if(score<40)return 'こぶりな貝柱、召し上がれ';
 if(score<60)return 'ほどよい貝柱、召し上がれ';
 if(score<80)return '立派な貝柱、召し上がれ';
 if(score<100)return '極上の貝柱、召し上がれ';
 return '完璧な貝柱、召し上がれ';
}
