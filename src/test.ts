import * as imageGeneration from './imageGen.json';

async function requestChatCompletion(prompt: string, apiKey: string) {
  const url = 'https://api.openai.com/v1/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tools: [imageGeneration],
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message;
}
type ChatCompletion = {
  prompt: string;
  ratio?: 'square' | 'portrait' | 'landscape';
  n?: number;
};
// Example usage:
export function runTest(API_KEY: string) {
  //return;
  requestChatCompletion('Make a picture of blue a dog.', API_KEY)
    .then(completion => {
      console.log('Chat completion received:', completion);
      generateImage(
        JSON.parse(completion.tool_calls[0].function.arguments || '{}') as ChatCompletion,
        API_KEY,
      );
      return;
    })
    .catch(err => console.error(err));
}

function generateImage(arg0: ChatCompletion, API_KEY: string) {
  const url = 'https://api.openai.com/v1/images/generations';

  const model = 'gpt-image-1';
  // const model = "dall-e-3";
  // const model = "dall-e-2";
  const [landscape, portrait, square] = [
    model === 'gpt-image-1' ? '1536x1024' : model === 'dall-e-3' ? '1536x1024' : '1024x1024',
    model === 'gpt-image-1' ? '1024x1536' : model === 'dall-e-3' ? '1024x1536' : '1024x1024',
    '1024x1024',
  ];
  const body = {
    model: model,
    prompt: arg0.prompt,
    //n: arg0.n || 1,
    //quality: "low",
    size: arg0.ratio === 'portrait' ? portrait : arg0.ratio === 'landscape' ? landscape : square,
  };
  console.log('Generating image with body:', body);
  return;

  fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
    .then(response => {
      if (!response.ok) throw new Error(`OpenAI API error: ${response.statusText}`);
      return response.json();
    })
    .then(data => {
      console.log('Image generation successful:', data);
      if (data.data && data.data.length > 0) {
        const imageUrl = data.data[0].url;
        const revised_prompt = data.data[0].revised_prompt || arg0.prompt;
        console.log('Revised prompt:', revised_prompt);
        console.log('Generated image URL:', imageUrl);
        // Here you can do something with the image URL, like displaying it or saving it
      } else {
        console.error('No image data returned from OpenAI API.');
      }
    })
    .catch(error => {
      console.error('Error generating image:', error);
    });
}
