import { describe, test, expect } from 'bun:test';
import { inferRelationships } from '../src/relationships.js';
import { makeSchema, makeAttr } from './test-helpers.js';

describe('inferRelationships', () => {
  test('forward ref via camelCase convention (userId → User)', () => {
    const order = makeSchema('Order', ['id', 'userId', 'total']);
    const user = makeSchema('User', ['id', 'name']);
    const rels = inferRelationships('Order', order, { Order: order, User: user });

    expect(rels).toContainEqual(
      expect.objectContaining({
        attribute: 'userId',
        targetTable: 'User',
        direction: 'forward',
        source: 'inferred',
      }),
    );
  });

  test('forward ref via snake_case convention (user_id → User)', () => {
    const order = makeSchema('Order', ['id', 'user_id']);
    const user = makeSchema('User', ['id', 'name']);
    const rels = inferRelationships('Order', order, { Order: order, User: user });

    expect(rels).toContainEqual(
      expect.objectContaining({
        attribute: 'user_id',
        targetTable: 'User',
        direction: 'forward',
        source: 'inferred',
      }),
    );
  });

  test('case-insensitive table matching', () => {
    const order = makeSchema('Order', ['id', 'categoryId']);
    const category = makeSchema('category', ['id', 'name']);
    const rels = inferRelationships('Order', order, { Order: order, category });

    expect(rels).toContainEqual(
      expect.objectContaining({
        attribute: 'categoryId',
        targetTable: 'category',
        direction: 'forward',
      }),
    );
  });

  test('API metadata overrides convention', () => {
    const schema = makeSchema('Order', ['id'], {
      attributes: [
        makeAttr('id', { is_primary_key: true }),
        makeAttr('authorRef', { relationship: { table: 'Author' } }),
      ],
    });
    const author = makeSchema('Author', ['id', 'name']);
    const rels = inferRelationships('Order', schema, { Order: schema, Author: author });

    expect(rels).toContainEqual(
      expect.objectContaining({
        attribute: 'authorRef',
        targetTable: 'Author',
        direction: 'forward',
        source: 'api',
      }),
    );
  });

  test('API metadata prevents duplicate from convention', () => {
    const schema = makeSchema('Order', ['id'], {
      attributes: [
        makeAttr('id', { is_primary_key: true }),
        makeAttr('authorId', { relationship: { table: 'Author' } }),
      ],
    });
    const author = makeSchema('Author', ['id']);
    const rels = inferRelationships('Order', schema, { Order: schema, Author: author });

    const authorRefs = rels.filter((r) => r.targetTable === 'Author' && r.direction === 'forward');
    expect(authorRefs).toHaveLength(1);
    expect(authorRefs[0].source).toBe('api');
  });

  test('reverse relationships from other tables', () => {
    const user = makeSchema('User', ['id', 'name']);
    const order = makeSchema('Order', ['id', 'userId', 'total']);
    const rels = inferRelationships('User', user, { User: user, Order: order });

    expect(rels).toContainEqual(
      expect.objectContaining({
        attribute: 'userId',
        targetTable: 'Order',
        direction: 'reverse',
        reverseAttribute: 'userId',
        source: 'inferred',
      }),
    );
  });

  test('reverse relationship via snake_case', () => {
    const user = makeSchema('User', ['id', 'name']);
    const order = makeSchema('Order', ['id', 'user_id']);
    const rels = inferRelationships('User', user, { User: user, Order: order });

    expect(rels).toContainEqual(
      expect.objectContaining({
        attribute: 'user_id',
        targetTable: 'Order',
        direction: 'reverse',
      }),
    );
  });

  test('self-reference is skipped', () => {
    const user = makeSchema('User', ['id', 'userId']);
    const rels = inferRelationships('User', user, { User: user });

    const forwardSelf = rels.filter((r) => r.direction === 'forward');
    expect(forwardSelf).toHaveLength(0);
  });

  test('no matching table is ignored', () => {
    const order = makeSchema('Order', ['id', 'fooId']);
    const rels = inferRelationships('Order', order, { Order: order });

    expect(rels).toHaveLength(0);
  });

  test('attribute named "Id" (length 2) is not matched', () => {
    const schema = makeSchema('Order', ['Id', 'name']);
    const id = makeSchema('', ['id']);
    const rels = inferRelationships('Order', schema, { Order: schema, '': id });

    const forward = rels.filter((r) => r.direction === 'forward');
    expect(forward).toHaveLength(0);
  });

  test('attribute named "_id" (length 3) is not matched', () => {
    const schema = makeSchema('Order', ['_id', 'name']);
    const rels = inferRelationships('Order', schema, { Order: schema });

    const forward = rels.filter((r) => r.direction === 'forward');
    expect(forward).toHaveLength(0);
  });

  test('empty allTables returns empty', () => {
    const schema = makeSchema('Order', ['id', 'userId']);
    const rels = inferRelationships('Order', schema, {});

    expect(rels).toHaveLength(0);
  });

  test('schema with no attributes returns empty', () => {
    const schema = makeSchema('Order', []);
    const rels = inferRelationships('Order', schema, { Order: schema });

    expect(rels).toHaveLength(0);
  });

  test('multiple forward and reverse refs together', () => {
    const order = makeSchema('Order', ['id', 'userId', 'productId']);
    const user = makeSchema('User', ['id', 'name']);
    const product = makeSchema('Product', ['id', 'name']);
    const lineItem = makeSchema('LineItem', ['id', 'orderId', 'qty']);
    const allTables = { Order: order, User: user, Product: product, LineItem: lineItem };
    const rels = inferRelationships('Order', order, allTables);

    const forward = rels.filter((r) => r.direction === 'forward');
    const reverse = rels.filter((r) => r.direction === 'reverse');

    expect(forward).toHaveLength(2);
    expect(forward.map((r) => r.targetTable).sort()).toEqual(['Product', 'User']);
    expect(reverse).toHaveLength(1);
    expect(reverse[0].targetTable).toBe('LineItem');
  });
});
