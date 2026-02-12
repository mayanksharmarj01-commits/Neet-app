'use client';

import { useEffect, useState } from 'react';
import 'katex/dist/katex.min.css';

interface LatexRendererProps {
    content: string;
    inline?: boolean;
    className?: string;
}

export function LatexRenderer({ content, inline = false, className = '' }: LatexRendererProps) {
    const [rendered, setRendered] = useState<string>('');
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const renderLatex = async () => {
            try {
                const katex = (await import('katex')).default;

                // Replace LaTeX delimiters
                let processedContent = content;

                // Inline math: $...$ or \(...\)
                processedContent = processedContent.replace(
                    /\$([^\$]+)\$/g,
                    (_, latex) => katex.renderToString(latex, { throwOnError: false })
                );

                processedContent = processedContent.replace(
                    /\\\(([^\\]+)\\\)/g,
                    (_, latex) => katex.renderToString(latex, { throwOnError: false })
                );

                // Display math: $$...$$ or \[...\]
                processedContent = processedContent.replace(
                    /\$\$([^\$]+)\$\$/g,
                    (_, latex) => katex.renderToString(latex, {
                        displayMode: true,
                        throwOnError: false
                    })
                );

                processedContent = processedContent.replace(
                    /\\\[([^\\]+)\\\]/g,
                    (_, latex) => katex.renderToString(latex, {
                        displayMode: true,
                        throwOnError: false
                    })
                );

                setRendered(processedContent);
            } catch (err) {
                console.error('LaTeX rendering error:', err);
                setError('Failed to render LaTeX');
                setRendered(content);
            }
        };

        renderLatex();
    }, [content]);

    if (error) {
        return (
            <div className={`text-red-500 ${className}`}>
                {error}: {content}
            </div>
        );
    }

    return (
        <div
            className={className}
            dangerouslySetInnerHTML={{ __html: rendered || content }}
        />
    );
}
