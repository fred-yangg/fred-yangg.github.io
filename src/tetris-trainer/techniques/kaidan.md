# Kaidan

Status: draft, not reviewed.
Sources: [four.lol](https://four.lol/methods/kaidan), [Hard Drop wiki](https://harddrop.com/wiki/Kaidan).

## What it is

A T-Spin Double on a staircase next to an open column. An S or Z stands in the
open column as the base of the T-slot, and the step above the slot is the
overhang. "Kaidan" (階段) means stairs.

It's a donation: the S/Z covers the open column for a moment, and the TSD
clears the two rows that cover it, so the column is open again afterward.
Back-to-Back is kept, and the column can still take a Tetris.

The parts, with the open column on the right (mirror everything, and swap Z
for S, for the left):

- **Stairs:** each row toward the column ends one cell further right.
- **Overhang:** the step above the slot, or a piece placed on it, such as an O.
- **Base:** a vertical Z in the open column. Its bottom cell hangs over the
  column.
- **Spin:** a T pointing down, clearing the two rows the Z's top cells are in.

```
Look for this     Create overhang   Create base       TSD               Result
..........        .....OO...        .....OO...        .....OO...        ..........
..........        .....OO...        .....OO...        .....OO...        .....OO...
#######...        ######....        ######...Z        ######TTTZ        .....OO...
######....        #######...        #######.ZZ        #######TZZ        ########Z.
#######...        ########..        ########Z.        ########Z.        #########.
########..        #########.        #########.        #########.
#########.
```

The board on the left already has its own overhang: the short row under a
longer one. The other boards use an O for it.

## When to use it

- You have stairs down to an open column (a Tetris well or garbage hole) and
  want a TSD without filling that column.
- To fix the parity of your stack (four.lol lists this as a main use).
- To clean up the overhang a TST leaves, when the TST's overhang piece was an
  S or Z.

When not to use it:

- The steps aren't built yet ("pre-Kaidan"). Hard Drop suggests building a QTK
  overhang and clearing with the Z instead of waiting for the steps.
- You only have an O where the S/Z should go. An Imperial TSS or TSD TSS is
  the compromise.
- A J as the base leaves the column covered afterward, so Hard Drop doesn't
  recommend it.

## Starting points

1. **Stairs at the edge.** Rows step down one cell at a time toward an open
   edge column. This is the textbook case above.
2. **Stairs in the middle.** Same shape against a well that isn't at the edge.
3. **Build the wall yourself.** Only part of the stairs is there and you
   finish it.
4. **Stairs from a line clear.** Clearing a line at the edge leaves the step
   shape. Hard Drop lists five situations for this (O and S, J and L, and I and
   T options), and prefers it to filling the bottom gap.
5. **After a TST.** The TST leaves an overhang. With an S or Z as that
   overhang, a Kaidan cleans it up.
6. **S/Z first.** Experienced players place the S/Z first and build the rest
   around it.

```
Steps in the middle     A TST with a Z overhang    After the TST, a Kaidan
.......###              #.........                 #.........
IIII...###              ##.....Z..                 #........I
###...Z###              #####.ZZ..                 #..SS....I
####.ZZ###              ######Z...                 ##SS...ZLI
#####Z.###              #######T##                 #####.ZZLI
######.###              #######TT#                 ######Z.LL
                        #######T##                 #######.##
                        #######.##                 #######.##
```

## Pieces

- An S or Z, matching the side the open column is on.
- Something for the overhang, unless the stairs already have one. Hard Drop
  lists overhangs with every piece (O, I, J, L, S, Z, T).
- A T.
- The overhang and the base can go in either order.
- The stairs need four rows. The rows above them don't have to be complete.

## What it leaves

Two rows clear. The open column is uncovered again, the S/Z's bottom cell is
left beside it, and the overhang piece stays where it was. Hard Drop lists
follow-ups into ST stacking (Kaidan ST Arrow) and Yoshihiro SD.

## How the trainer should test it

- **Start:** a realistic stack with stairs down to an open column, in one of
  the shapes above, with a random 7-bag preview. Sometimes the right S/Z or the
  T is a few pieces away.
- **Goal:** a TSD whose base is the S/Z standing in the open column, finishing
  with that column open (that's the ideal board).
- **Wrong-call positions:** no steps yet (QTK is better), the S/Z needed isn't
  coming (Imperial TSS / TSD TSS), or the column should stay open for a Tetris
  instead.
- **Built so far:** stairs at the edge or in the middle, with or without the
  overhang already there. Wrong calls: the S/Z swapped out of the preview, or
  a Kaidan that works but leaves a worse board. Not yet: pre-Kaidan (QTK) and
  keeping the column for a Tetris.

## Questions

- Is Kaidan only the S/Z-over-the-column TSD, or do you also count S/Z props
  that don't sit over an open column?
- How do you decide between a Kaidan and keeping the well for a Tetris?
- How exactly does it fix parity in the positions you see?
- Do you ever use it with only three stair rows?

## Examples from play

None yet. Add fumen links here.
