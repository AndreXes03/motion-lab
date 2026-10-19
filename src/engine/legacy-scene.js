/** Import-only compatibility for links and recipes created before the neutral demo. */
const previousScene = 'bax';
export const canonicalScene = id => id === previousScene ? 'objects' : id;
export function migrateLegacyScene(value) {
 if (typeof value === 'string') return value === previousScene ? 'objects' : value.replaceAll(previousScene + '.', 'objects.');
 if (Array.isArray(value)) return value.map(migrateLegacyScene);
 if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item]) => [key.replaceAll(previousScene + '.', 'objects.'),['commercial','music','edit'].includes(key)?structuredClone(item):migrateLegacyScene(item)]));
 return value;
}
