import { gatherInfo, ProvidedInfo } from './command-handler';
import isNumber from 'lodash/isNumber';
import toNumber from 'lodash/toNumber';
import isNaN from 'lodash/isNaN';

const questions = [
  {
    name: 'topic',
    message: 'Qué tema quieres parsear? (Opcional, dejar vacío para parsear todos los temas)',
  },
];

// TODO: Parse available topics in page.
export async function getTopic(
  providedInfo: ProvidedInfo<typeof questions>
): Promise<number | null> {
  const { topic } = await gatherInfo<typeof questions>(questions, providedInfo);

  const parsedTopic = toNumber(topic);

  if (isNumber(parsedTopic) && !isNaN(parsedTopic)) {
    return parsedTopic;
  }

  return null;
}
