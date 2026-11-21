// Unit tests for book results aggregation logic
import { assertEquals, test } from './_testkit.ts';
import { rankBoard } from './stats.ts';

test('books: rankBoard per book ranks students by stars then chapters done', () => {
  const students = [
    { id: '1', name: 'مينا', stars: 10, streak: 3 },
    { id: '2', name: 'أحمد', stars: 15, streak: 3 },
    { id: '3', name: 'مريم', stars: 10, streak: 4 },
  ];
  const ranked = rankBoard(students);
  assertEquals(ranked[0]!.id, '2'); // highest stars (15)
  assertEquals(ranked[1]!.id, '3'); // tied stars (10), higher streak/done (4)
  assertEquals(ranked[2]!.id, '1'); // tied stars (10), lower streak/done (3)
});
