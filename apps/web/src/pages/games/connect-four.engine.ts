export type Cell=0|1|2;
export type Board=Cell[][];
export const ROWS=6,COLS=7;
export function emptyBoard():Board{return Array.from({length:ROWS},()=>Array<Cell>(COLS).fill(0));}
export function parseBoard(raw:unknown):Board|null{
 if(!Array.isArray(raw)||raw.length!==ROWS)return null;const result:Board=[];
 for(const row of raw){if(!Array.isArray(row)||row.length!==COLS||!row.every(v=>v===0||v===1||v===2))return null;result.push([...row]);}
 for(let c=0;c<COLS;c++){let gap=false;for(let r=ROWS-1;r>=0;r--){if(result[r]?.[c]===0)gap=true;else if(gap)return null;}}
 return result;
}
export function validColumns(b:Board):number[]{return Array.from({length:COLS},(_,c)=>c).filter(c=>b[0]?.[c]===0);}
export function rowForColumn(c:number,b:Board):number{if(!Number.isInteger(c)||c<0||c>=COLS)return -1;for(let r=ROWS-1;r>=0;r--)if(b[r]?.[c]===0)return r;return -1;}
export function copyBoard(b:Board):Board{return b.map(r=>[...r]);}
export function dropDisc(b:Board,c:number,p:1|2):number{const r=rowForColumn(c,b),row=b[r];if(r<0||!row)return -1;row[c]=p;return r;}
const directions:readonly (readonly [number,number])[]=[[0,1],[1,0],[1,1],[1,-1]];
export function winningLine(b:Board):{player:1|2;cells:number[][]}|null{for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const p=b[r]?.[c];if(p!==1&&p!==2)continue;for(const [dr,dc] of directions){const cells:number[][]=[];for(let k=0;k<4;k++){const rr=r+dr*k,cc=c+dc*k;if(rr<0||rr>=ROWS||cc<0||cc>=COLS||b[rr]?.[cc]!==p)break;cells.push([rr,cc]);}if(cells.length===4)return {player:p,cells};}}return null;}
function immediate(p:1|2,b:Board){for(const c of validColumns(b)){const x=copyBoard(b);dropDisc(x,c,p);if(winningLine(x))return c;}return null;}
function scoreWindow(a:Cell[],p:1|2){const o=p===1?2:1,n=a.filter(x=>x===p).length,e=a.filter(x=>x===0).length,q=a.filter(x=>x===o).length;return n===4?100000:n===3&&e===1?160:n===2&&e===2?24:q===3&&e===1?-190:q===2&&e===2?-20:0;}
function evaluate(b:Board,p:1|2){let score=0;for(let r=0;r<ROWS;r++){if(b[r]?.[3]===p)score+=12;for(let c=0;c<COLS;c++)for(const [dr,dc] of directions){const endR=r+3*dr,endC=c+3*dc;if(endR<0||endR>=ROWS||endC<0||endC>=COLS)continue;const cells:Cell[]=[];for(let k=0;k<4;k++){const v=b[r+k*dr]?.[c+k*dc];if(v!==undefined)cells.push(v);}if(cells.length===4)score+=scoreWindow(cells,p);}}return score;}
function minimax(b:Board,d:number,max:boolean,a=-Infinity,z=Infinity):number{const w=winningLine(b);if(w)return w.player===2?1000000+d:-1000000-d;const cols=validColumns(b);if(!d||!cols.length)return evaluate(b,2);let v=max?-Infinity:Infinity;for(const c of cols){const x=copyBoard(b);dropDisc(x,c,max?2:1);const next=minimax(x,d-1,!max,a,z);if(max){v=Math.max(v,next);a=Math.max(a,v);}else{v=Math.min(v,next);z=Math.min(z,v);}if(a>=z)break;}return v;}
export function chooseColumn(b:Board,requestedDepth:number):number{const cols=validColumns(b);if(!cols.length)return -1;const win=immediate(2,b);if(win!==null)return win;const block=immediate(1,b);if(block!==null)return block;const depth=Number.isFinite(requestedDepth)?Math.max(1,Math.min(5,Math.floor(requestedDepth))):2;let best=-Infinity;let selected=cols[0]??-1;for(const c of cols){const x=copyBoard(b);dropDisc(x,c,2);const s=minimax(x,depth-1,false)+(3-Math.abs(3-c))*2;if(s>best){best=s;selected=c;}}return selected;}
