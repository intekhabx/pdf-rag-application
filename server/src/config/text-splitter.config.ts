import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";


const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});


export default splitter;


/**
 * RecursiveCharacterTextSplitter kaise kaam karta hai:
 *
 * 1. Ye text ko "natural" jagahon pe todne ki koshish karta hai, is order me:
 *      "\n\n" (paragraph)  ->  "\n" (line)  ->  " " (word)  ->  "" (character)
 *
 * 2. Pehle paragraph se todta hai. Agar koi tukda abhi bhi chunkSize (1000)
 *    se bada hai, to us tukde ko agle separator ("\n") se todta hai.
 *    Phir bhi bada ho to " " se, aur akhir me character-by-character.
 *    Isi "dobara-dobara try karne" ki wajah se naam me "Recursive" hai.
 *
 * 3. Chhote tukdon ko wapas jod ke ek chunk banata hai, jab tak wo
 *    chunkSize se bada na ho jaye. Isse sentence ya paragraph beech me
 *    kam hi katta hai.
 *
 * 4. chunkSize = ek chunk me max 1000 CHARACTERS (tokens nahi).
 *
 * 5. chunkOverlap = 200: agle chunk ke shuru me pichhle chunk ke aakhri
 *    ~200 characters dobara aate hain. Isse agar koi baat do chunks ke
 *    beech kat jaye, to bhi context bacha rehta hai aur search better hota hai.
 *
 * 6. splitDocuments() use karne pe har chunk me original metadata
 *    (source, page number jaise loc.pageNumber) saath me copy ho jaata hai,
 *    isliye citations me page number dikhana sahi rahta hai.
 */
