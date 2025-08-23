// Sample file for analyzer testing
console.log('This should be detected by the analyzer');

function exampleFunction(): void {
  // TODO: Implement this function properly
  console.warn('Another console usage to detect');
  
  const data = { message: 'Hello World' };
  
  // eslint-disable-next-line no-console
  console.info('This one has an eslint disable comment');
}

export default exampleFunction;