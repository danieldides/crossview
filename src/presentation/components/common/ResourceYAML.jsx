import { Box, Button, Text } from '@chakra-ui/react';
import { useState, useMemo } from 'react';
import { FiCopy } from 'react-icons/fi';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import {crossviewMirrorTheme} from '../../utils/crossviewMirrorTheme.js'
import YAML from 'yaml';
import { getTextColor, colors } from '../../utils/theme.js';

export const ResourceYAML = ({ fullResource, colorMode }) => {
  const [copied, setCopied] = useState(false);

  const yamlContent = useMemo(() => {
    if (!fullResource) return '';
    try {
      return YAML.stringify(fullResource, { indent: 2, simpleKeys: true });
    } catch {
      return '';
    }
  }, [fullResource]);

  return (
    <Box p={4} h="100%" flex={1} overflow="auto">
      <Box
        borderRadius="md"
        overflow="hidden"
        position="relative"
        
      >
        <Button
          size="sm"
          variant="ghost"
          position="absolute"
          top={2}
          right={2}
          zIndex={10}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(yamlContent);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {}
          }}
          aria-label="Copy YAML"
          minW="auto"
          h="32px"
          px={2}
          bg={colorMode === 'dark' ? colors.code.dark.buttonBg : colors.code.light.buttonBg}
          _hover={{
            bg: colorMode === 'dark' ? colors.code.dark.buttonBgHover : colors.code.light.buttonBgHover,
          }}
          color={getTextColor(colorMode, colorMode === 'dark' ? 'secondary' : 'inverse')}
        >
          {copied ? <Text fontSize="xs" mr={1}>Copied!</Text> : <FiCopy size={16} />}
        </Button>
        <CodeMirror
          value={yamlContent}
          height="100%"
          extensions={[yaml()]}
          theme={colorMode === 'dark' ? crossviewMirrorTheme : undefined}
          readOnly
          style={{
            fontSize: '0.75rem',
            lineHeight: '1.5',
            
          }}
        />
      </Box>
    </Box>
  );
};