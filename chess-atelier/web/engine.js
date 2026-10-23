import {Chess} from './vendor/chess.js';
export {Chess};
const values={p:100,n:320,b:335,r:500,q:900,k:0};
export function evaluate(chess) {
  if(chess.isCheckmate())return chess.turn()==='w'?-100000:100000;
  if(chess.isDraw())return 0;
  let score=0;
  for(const [r,row] of chess.board().entries())for(const [c,piece] of row.entries())if(piece){
    const center=3.5-Math.max(Math.abs(c-3.5),Math.abs(r-3.5));
    const development=piece.type==='p'?(piece.color==='w'?6-r:r-1)*7:['n','b'].includes(piece.type)?center*14:0;
    score+=(piece.color==='w'?1:-1)*(values[piece.type]+development);
  }
  return score;
}
export function chooseMove(chess,depth=2) {
  const side=chess.turn()==='w'?1:-1;
  function search(d,alpha,beta){
    if(d===0||chess.isGameOver())return evaluate(chess);
    const maximizing=chess.turn()==='w';let best=maximizing?-Infinity:Infinity;
    const moves=chess.moves({verbose:true}).sort((a,b)=>(values[b.captured]||0)-(values[a.captured]||0));
    for(const move of moves){chess.move(move);const score=search(d-1,alpha,beta);chess.undo();best=maximizing?Math.max(best,score):Math.min(best,score);if(maximizing)alpha=Math.max(alpha,best);else beta=Math.min(beta,best);if(beta<=alpha)break;}
    return best;
  }
  let best=-Infinity,choice=null;
  for(const move of chess.moves({verbose:true})){chess.move(move);const score=side*search(depth-1,-Infinity,Infinity);chess.undo();if(score>best){best=score;choice=move;}}
  return choice;
}
