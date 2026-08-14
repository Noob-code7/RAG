import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { mkdir, writeFile } from 'node:fs/promises';

interface PageSpec {
  title: string;
  paragraphs: string[];
}

interface DocSpec {
  filename: string;
  pages: PageSpec[];
}

const DEMO_DOCUMENTS: DocSpec[] = [
  {
    filename: 'data-structures-syllabus.pdf',
    pages: [
      {
        title: 'CS 220 — Data Structures & Algorithms: Syllabus',
        paragraphs: [
          'Course CS 220 introduces the fundamental data structures used throughout computer science — arrays, linked lists, stacks, queues, hash tables, trees, and graphs — along with the algorithmic techniques for searching, sorting, and analyzing them.',
          'Prerequisites: CS 110 (Introduction to Programming) or equivalent experience in a modern programming language. Comfort with recursion and basic time-complexity reasoning is expected by mid-semester.',
          'Textbook: "Introduction to Algorithms" by Cormen, Leiserson, Rivest, and Stein (CLRS), plus the freely available course lecture notes distributed each week on the course portal.',
          'Grading: homework assignments 30%, one midterm 20%, a final exam 25%, and a semester-long programming project worth 25%. The project requires implementing and benchmarking a balanced search tree against a hash table.',
          'The midterm covers arrays, linked lists, stacks, queues, and complexity analysis. The final exam is cumulative but emphasizes trees, graphs, and algorithm design patterns such as divide and conquer and dynamic programming.',
          'Academic honesty: all submitted work must be your own. Reusing code from online repositories without citation is a violation and results in a zero for the assignment plus a report to the university conduct board.',
        ],
      },
      {
        title: 'CS 220 — Weekly Schedule (Weeks 1–7)',
        paragraphs: [
          'Week 1: Mathematical foundations — growth of functions, Big-O, Big-Theta, and Big-Omega notation. Week 2: Arrays and dynamic arrays, amortized cost of resizing. Week 3: Singly and doubly linked lists; comparing contiguous and linked storage.',
          'Week 4: Stacks and queues, including applications in expression evaluation and breadth-first search. Week 5: Hash tables — hash functions, collision resolution by chaining and open addressing, load factor and expected cost.',
          'Week 6: Binary search trees, tree traversals, and the BST property. Week 7: Balanced trees — AVL rotations and red-black tree invariants. Homework 3 asks you to implement an AVL tree from scratch in C++ or Python.',
          'Weeks 8–10: Heaps and priority queues, then heapsort. Weeks 11–12: Graph representations — adjacency lists versus adjacency matrices — and graph traversals BFS and DFS.',
          'Weeks 13–14: Shortest paths (Dijkstra and Bellman-Ford) and minimum spanning trees (Kruskal and Prim). The final project is due in week 15, before the exam week.',
        ],
      },
    ],
  },
  {
    filename: 'lecture-notes-arrays-and-linked-lists.pdf',
    pages: [
      {
        title: 'Lecture 3 — Arrays and Dynamic Arrays',
        paragraphs: [
          'An array is a contiguous block of memory holding elements of the same type. The address of element i is base_address plus i times the element size, which is why random access is O(1): the arithmetic is independent of the array length.',
          'Insertion into the middle of an array is O(n) because every element after the insertion point must be shifted right by one slot. Deletion from the middle has the same cost for the opposite reason.',
          'A dynamic array hides the resizing problem from the caller. When the underlying array is full, a new array of double the capacity is allocated, all elements are copied over, and the old memory is freed.',
          'The doubling strategy is what makes append amortized O(1). Although a single resize copies n elements, each element participates in only a logarithmic number of resizes over the lifetime of the array, so the average cost per append stays constant.',
          'Trade-offs: arrays win on cache locality and random access but lose on arbitrary insertion and deletion. This is the fundamental tension we return to when we compare contiguous storage with linked storage next.',
        ],
      },
      {
        title: 'Lecture 4 — Linked Lists',
        paragraphs: [
          'A linked list stores elements in nodes that are not necessarily adjacent in memory. Each node holds its data plus a pointer to the next node; a doubly linked list also keeps a pointer to the previous node.',
          'Because nodes are allocated separately, inserting at the head (or after a given node) is O(1) — you only relink a constant number of pointers, no shifting required. The same applies to deletion when you already hold the node to remove.',
          'The price is that random access becomes O(n): finding element k requires walking the list node by node. Linked lists also lose cache locality, since nodes are scattered across memory rather than stored contiguously.',
          'Space overhead is another cost: every node carries one or two extra pointers, so a linked list of small integers can use several times more memory than an array holding the same data.',
          'Practical guidance: if your workload is dominated by appends and random reads, use a dynamic array. If it is dominated by insertions and deletions at known positions, a linked list can be the right tool.',
        ],
      },
    ],
  },
  {
    filename: 'lecture-notes-trees-and-graphs.pdf',
    pages: [
      {
        title: 'Lecture 6 — Binary Search Trees',
        paragraphs: [
          'A binary search tree is a binary tree in which, for every node, all keys in the left subtree are less than the node key and all keys in the right subtree are greater. This ordering property is what makes search fast.',
          'Search, insert, and delete all descend from the root, comparing against the current node and moving left or right, so their cost is proportional to the height of the tree.',
          'The worst case is a degenerate tree — e.g., inserting keys in sorted order — which degrades to a linked list with height n and O(n) operations. This motivates the balanced trees of the next lecture.',
          'Tree traversals come in three standard orders. Pre-order visits the node, then the left subtree, then the right. In-order visits left, node, right, and on a BST yields the keys in sorted order. Post-order visits children before the parent.',
          'In-order traversal of a BST is the classic O(n) way to output the elements in sorted order without an explicit sort, and it is used by tree-based sorting algorithms such as TreeSort.',
        ],
      },
      {
        title: 'Lecture 8 — Balanced Trees',
        paragraphs: [
          'A balanced search tree keeps its height logarithmic in the number of keys so that the O(log n) bound on search, insert, and delete is actually achieved rather than hypothetical.',
          'An AVL tree enforces the invariant that for every node, the heights of its two subtrees differ by at most one. Insertions and deletions that violate this invariant are fixed with single or double rotations.',
          'A red-black tree relaxes the balance requirement slightly, guaranteeing that the longest path from root to leaf is at most twice the shortest. It needs fewer rotations during insertion and is used by many standard libraries.',
          'The height of a red-black tree with n nodes is at most 2*log2(n+1), which is why the operations are O(log n) in the worst case while still allowing fast updates.',
          'Self-balancing trees are the workhorse behind ordered maps and ordered sets: membership queries, predecessor and successor queries, and range scans are all supported in logarithmic time.',
        ],
      },
      {
        title: 'Lecture 11 — Graph Traversals: BFS and DFS',
        paragraphs: [
          'A graph is a set of vertices connected by edges, and it can be directed or undirected. Two common representations are the adjacency list, where each vertex stores its neighbors, and the adjacency matrix, a V-by-V boolean grid.',
          'Adjacency lists use O(V+E) space and make iterating over a vertexs neighbors cheap, which most graph algorithms require, so lists are usually the right default. Matrices use O(V^2) space but offer O(1) edge-existence checks.',
          'Breadth-first search (BFS) explores the graph in layers, using a queue, and computes the shortest path in terms of the number of edges from a source vertex. It is the algorithm behind pathfinding in unweighted grids.',
          'Depth-first search (DFS) explores as far as possible along each branch before backtracking, using a stack or recursion. DFS is the basis for topological sorting, cycle detection, and connected-component analysis.',
          'BFS has the useful property that when it first reaches a vertex, the route taken is a shortest path. DFS instead prioritizes depth, which makes it natural for exploring all reachable structure but not for finding the shortest route.',
        ],
      },
    ],
  },
  {
    filename: 'homework-01-big-o-and-arrays.pdf',
    pages: [
      {
        title: 'Homework 1 — Big-O Analysis and Arrays',
        paragraphs: [
          'Exercise 1. For each of the following functions, give the tightest Big-O bound and justify your answer in one or two sentences: (a) 3n^2 + 5n log n, (b) 2^n + n^10, (c) n log n + 100n, (d) sqrt(n) + n.',
          'Exercise 2. You insert n elements one at a time into a dynamic array that starts at capacity 1 and doubles when full. Show that the total cost of all n insertions is O(n) using the accounting method.',
          'Exercise 3. Implement a function that removes all duplicates from an unsorted array of integers in place. State the time and space complexity of your solution, and describe a faster approach that uses a hash set.',
          'Exercise 4. Write pseudocode to rotate an array of n elements to the left by k positions using only O(1) extra space. Your solution must run in O(n) time and must not use a second array.',
          'Submission rules: submit a single PDF containing your written answers and any code as a readable monospace block. Homework is due at the start of lecture in week 4; late submissions lose 10% per day.',
        ],
      },
    ],
  },
];

function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    if (current && current.length + word.length + 1 > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function buildPdf(filename: string, pages: PageSpec[]): Promise<void> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.12);

  for (const pageSpec of pages) {
    const page = doc.addPage([612, 792]); // US Letter
    const margin = 60;
    let y = 760;

    page.drawText(pageSpec.title, { x: margin, y, size: 15, font: bold, color: ink });
    y -= 36;

    for (const paragraph of pageSpec.paragraphs) {
      const wrapped = wrapText(paragraph, 88);
      for (const line of wrapped) {
        page.drawText(line, { x: margin, y, size: 11, font, color: ink });
        y -= 18;
      }
      y -= 12; // paragraph gap
    }
  }

  const bytes = await doc.save();
  await mkdir('sample-data', { recursive: true });
  const outPath = `sample-data/${filename}`;
  await writeFile(outPath, bytes);
  console.log(`Wrote ${outPath} (${pages.length} pages)`);
}

async function main(): Promise<void> {
  for (const spec of DEMO_DOCUMENTS) {
    await buildPdf(spec.filename, spec.pages);
  }
  console.log(`\nDone. ${DEMO_DOCUMENTS.length} documents in sample-data/.`);
  console.log('Upload them with: npm run seed-demo');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});