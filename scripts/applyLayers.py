# Usage: python3 scripts/applyLayers.py "h,hEnd,hp" x7  -> writes numbers into src/data/layers.ts
import re, sys
vals=[v.split(',') for v in sys.argv[1:]]
p='src/data/layers.ts'; s=open(p).read()
i=[0]
def r1(m):
    k=i[0]; i[0]+=1
    return "hardness: %s, hardnessEnd: %s,"%(vals[k][0],vals[k][1])
s=re.sub(r"hardness: [0-9.e]+, hardnessEnd: [0-9.e]+,",r1,s)
i=[0]
def r2(m):
    k=i[0]; i[0]+=1
    return "hp: %s, color"%vals[k][2]
s=re.sub(r"hp: [0-9.e]+, color",r2,s)
open(p,'w').write(s)
